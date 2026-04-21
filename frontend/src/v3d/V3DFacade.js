import { markRaw } from 'vue';
import { Box } from "@/v3d/box";
import { Director } from "@/v3d/director";
import ModelGenerator from "@/v3d/generator/ModelGenerator.js";
import { BaseRotation } from "@/v3d/animation/baseRotation";
import { STLExporter } from 'three/examples/jsm/exporters/STLExporter';
import { OBJExporter } from 'three/examples/jsm/exporters/OBJExporter';
import JSZip from 'jszip';
import { save, saveAsArrayBuffer, saveAsString } from '@/utils';

/**
 * Фасад для работы с библиотекой v3d
 * Предоставляет упрощенный API для генерации 3D моделей, отрисовки и экспорта
 */
export class V3DFacade {
  constructor(config = {}) {
    this.config = {
      debug: false,
      ...config
    };

    this.initialized = false
    
    this.box = null;
    this.director = null;
    this.currentGenerator = null;
    this.entitiesData = null;
    this.qrCodeBitMask = null;
  }

  /**
   * Инициализация сцены
   * @param {HTMLElement|string} container - DOM элемент или его ID
   * @param {Object} config - Конфигурация сцены
   * @returns {HTMLElement} DOM элемент рендерера
   */
  initialize(container, config = {}) {
    const containerElement = typeof container === 'string' 
      ? document.getElementById(container) 
      : container;

    if (!containerElement) {
      throw new Error('Container element not found');
    }

    // Создаем Box с анимацией
    const animation = new BaseRotation();
    this.box = new Box({ 
      debug: this.config.debug, 
      animation: animation 
    });
    
    // Создаем сцену
    this.box.createScene();
    
    // Создаем камеру и рендерер
    const width = containerElement.clientWidth;
    const height = containerElement.clientHeight;
    const pixelRatio = window.devicePixelRatio || 1;
    
    this.box.createCamera(width, height);
    this.box.createRenderer(width, height, pixelRatio);
    this.box.createControl();
    
    // Помечаем все объекты Three.js как markRaw для предотвращения реактивности Vue 3
    // Это нужно сделать после создания всех объектов
    this.box.scene = markRaw(this.box.scene);
    this.box.camera = markRaw(this.box.camera);
    this.box.renderer = markRaw(this.box.renderer);
    if (this.box.grid) {
      this.box.grid = markRaw(this.box.grid);
    }
    if (this.box.sceneGraphRoot) {
      this.box.sceneGraphRoot = markRaw(this.box.sceneGraphRoot);
    }
    
    // Добавляем рендерер в контейнер
    containerElement.appendChild(this.box.renderer.domElement);
    
    // Создаем директор для работы с сущностями
    this.director = new Director();
    this.initialized = true
    
    return this.box.renderer.domElement;
  }

  /**
   * Генерация 3D модели из данных сущностей
   * @param {Object} entitiesData - Данные сущностей (base, border, code, text, icon, keychain, magnet, content)
   * @param {Function} progressCallback - Callback для отслеживания прогресса (percent) => void
   * @returns {Promise<Object>} Promise с коллекцией мешей
   */
  async generateModel(entitiesData, progressCallback = null) {
    if (!this.box) {
      throw new Error('Scene not initialized. Call initialize() first.');
    }

    this.entitiesData = entitiesData;
    
    // Очищаем сцену
    this.box.clear();
    
    // Создаем сущности через Director
    this.director.buildGroupBuilder(entitiesData);
    const entities = this.director.getEntities();
    
    // Определяем тип модели и создаем генератор
    const hasQRCode = entities.code && entities.code.active;
    
    // Для QR кода нужен битмаск
    if (hasQRCode && !this.qrCodeBitMask) {
      throw new Error('QR code bitmask is required. Call setQRCodeBitMask() first.');
    }
    
    // Создаем единый генератор с опциональным QR битмаском
    this.currentGenerator = new ModelGenerator(entities, this.qrCodeBitMask || null);
    
    // Настраиваем callback для прогресса перед генерацией (только для QR кода)
    let generationComplete = false;
    if (hasQRCode) {
      const originalProcess = this.currentGenerator.process;
      
      this.currentGenerator.process = (percent) => {
        if (progressCallback) {
          progressCallback(percent);
        }
        if (percent >= 100 && !generationComplete) {
          generationComplete = true;
        }
        if (originalProcess && originalProcess !== this.currentGenerator.process) {
          originalProcess(percent);
        }
      };
    }
    
    // Генерируем базовые меши
    const meshes = {
      base: this.currentGenerator.getBaseMesh(),
      border: this.currentGenerator.getBorderMesh(),
      keychain: this.currentGenerator.getKeychainMesh(),
      icon: this.currentGenerator.getIconMesh(),
      text: this.currentGenerator.getTextMesh(),
    };
    
    // Генерируем QR код если нужно (меш строится синхронно — один Mesh с merged BufferGeometry)
    if (hasQRCode) {
      this.currentGenerator.getQRCodeMesh();
      if (this.currentGenerator.finalBlock) {
        meshes.qr = this.currentGenerator.finalBlock;
      }
    }
    if (progressCallback) {
      progressCallback(100);
    }
    
    // Добавляем меши на сцену
    // Помечаем все меши как markRaw для предотвращения реактивности Vue 3
    for (const key in meshes) {
      if (meshes[key]) {
        const mesh = markRaw(meshes[key]);
        this.box.addNode(key, mesh);
      }
    }

    // Ставим модель к нулевому углу сетки и наводим камеру на неё.
    this.box.placeAndFocusModel();

    return meshes;
  }

  /**
   * Установка битмаска QR кода
   * @param {Array|Uint8Array} bitmask - Битмаск QR кода
   */
  setQRCodeBitMask(bitmask) {
    this.qrCodeBitMask = bitmask;
  }

  /**
   * Отрисовка сцены
   */
  render() {
    if (!this.box) {
      throw new Error('Scene not initialized. Call initialize() first.');
    }
    this.box.render();
  }

  /**
   * Запуск анимации
   * @param {Function} animateCallback - Callback для анимации (time) => void
   */
  startAnimation(animateCallback = null) {
    if (!this.box) {
      throw new Error('Scene not initialized. Call initialize() first.');
    }
    
    const animate = (time) => {
      time *= 0.001
      this.box.animate(false, time)
      this.box.render()
      
      if (animateCallback) {
        animateCallback(time)
      }
      
      requestAnimationFrame(animate)
    };
    
    requestAnimationFrame(animate)
  }

  /**
   * Установка автоматической анимации вращения
   * @param {boolean} enabled - Включить/выключить анимацию
   */
  setAnimation(enabled) {
    if (!this.box) {
      throw new Error('Scene not initialized. Call initialize() first.');
    }
    // Анимация управляется через startAnimation
    // Этот метод можно использовать для остановки/запуска
  }

  /**
   * Экспорт модели в STL формат
   * @param {Object} options - Опции экспорта
   * @param {boolean} options.binary - Бинарный формат (по умолчанию true)
   * @param {boolean} options.multiple - Экспорт отдельных частей в ZIP (по умолчанию false)
   * @param {string} options.filename - Имя файла (опционально)
   * @returns {Promise<Blob|void>} Promise с Blob или void если файл скачан автоматически
   */
  async exportSTL(options = {}) {
    if (!this.box) {
      throw new Error('Scene not initialized. Call initialize() first.');
    }

    const {
      binary = true,
      multiple = false,
      filename = null
    } = options;

    const exporter = new STLExporter();
    const exportAsBinary = binary;
    const expConfig = { binary: exportAsBinary };

    if (multiple) {
      // Экспорт отдельных частей в ZIP
      const parts = this.box.getNodes();
      const zip = new JSZip();

      for (const key in parts) {
        if (parts[key]) {
          const data = exporter.parse(parts[key], expConfig);
          const partFilename = filename 
            ? `${key}-${filename}.stl` 
            : `${key}-${this.generateFilename()}.stl`;
          zip.file(partFilename, data.buffer);
        }
      }

      const zipBlob = await zip.generateAsync({ type: 'blob' });
      const zipFilename = filename 
        ? `${filename}.zip` 
        : `${this.generateFilename()}.zip`;
      save(zipBlob, zipFilename);
      
      return zipBlob;
        } else {
          // Экспорт объединенной модели — передаём sceneGraphRoot целиком,
          // STLExporter сам traverse'ит все дочерние Mesh
          this.box.sceneGraphRoot.updateMatrixWorld(true);
          const result = exporter.parse(this.box.sceneGraphRoot, expConfig);
          const stlFilename = filename || `${this.generateFilename()}.stl`;

          if (exportAsBinary) {
            saveAsArrayBuffer(result, stlFilename);
          } else {
            saveAsString(result, stlFilename);
          }

          return new Blob([result], {
            type: exportAsBinary ? 'application/octet-stream' : 'text/plain'
          });
        }
  }

  /**
   * Экспорт модели в OBJ формат
   * @param {string} filename - Имя файла (опционально)
   * @returns {Promise<string>} Promise с содержимым OBJ файла
   */
  async exportOBJ(filename = null) {
    if (!this.box) {
      throw new Error('Scene not initialized. Call initialize() first.');
    }

    const exporter = new OBJExporter();
    const result = exporter.parse(this.box.getScene());
    const objFilename = filename || `${this.generateFilename()}.obj`;
    
    saveAsArrayBuffer(result, objFilename);
    
    return result;
  }

  /**
   * Генерация имени файла на основе параметров модели
   * @returns {string} Имя файла
   */
  generateFilename() {
    if (!this.entitiesData) {
      return `model-${Date.now()}`;
    }

    const timestamp = Date.now();
    let params = '';

    if (this.entitiesData.keychain?.active) {
      params += 'key_';
    }
    if (this.entitiesData.code?.active) {
      params += 'qr_';
    }
    if (this.entitiesData.base?.active) {
      params += `${this.entitiesData.base.width}x${this.entitiesData.base.height}x${this.entitiesData.base.depth}-radius${this.entitiesData.base.cornerRadius}_`;
    }
    if (this.entitiesData.text?.active) {
      params += `text${this.entitiesData.text.size}_`;
    }
    if (this.entitiesData.magnet?.active) {
      params += `magnet${this.entitiesData.magnet.size}x${this.entitiesData.magnet.depth}_`;
    }

    return `${params}${timestamp}`;
  }

  /**
   * Очистка сцены
   */
  clear() {
    if (this.box) {
      this.box.clear();
    }
    this.currentGenerator = null;
    this.entitiesData = null;
  }

  /**
   * Получение сцены Three.js
   * @returns {THREE.Scene} Сцена
   */
  getScene() {
    if (!this.box) {
      throw new Error('Scene not initialized. Call initialize() first.');
    }
    return this.box.getScene();
  }

  /**
   * Получение камеры Three.js
   * @returns {THREE.Camera} Камера
   */
  getCamera() {
    if (!this.box) {
      throw new Error('Scene not initialized. Call initialize() first.');
    }
    return this.box.camera;
  }

  /**
   * Получение рендерера Three.js
   * @returns {THREE.WebGLRenderer} Рендерер
   */
  getRenderer() {
    if (!this.box) {
      throw new Error('Scene not initialized. Call initialize() first.');
    }
    return this.box.renderer;
  }

  /**
   * Получение Box для прямого доступа (если необходимо)
   * @returns {Box} Экземпляр Box
   */
  getBox() {
    return this.box;
  }

  /**
   * Получение URL изображения сцены
   * @returns {string} Data URL изображения
   */
  getImageDataUrl() {
    if (!this.box) {
      throw new Error('Scene not initialized. Call initialize() first.');
    }
    return this.box.imgDataUrl();
  }

  /**
   * Обновление размера рендерера
   * @param {number} width - Ширина
   * @param {number} height - Высота
   */
  setSize(width, height) {
    if (!this.box) {
      throw new Error('Scene not initialized. Call initialize() first.');
    }
    this.box.camera.aspect = width / height;
    this.box.camera.updateProjectionMatrix();
    this.box.renderer.setSize(width, height);
  }
}
