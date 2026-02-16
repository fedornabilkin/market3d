export default {

  name: 'Русский',

  /**
   * Language
   */
  l: {
    change: 'Изменить язык',
  },

  /**
   * General translate
   */
  g: {
    title: '3D Генератор STL',
    subtitle: 'Экспорт QR кода или текста в формате STL для 3D печати',
    preview: 'Просмотр',
    controlsHint: 'Можно вращать',
    autoRotation: 'Автоповорот',
    generateButton: 'Создать 3D модель',
    historyButton: 'История',
    scanModalTitle: 'Код должен быть перед камерой',
    readModalTitle: 'Загрузите файл с QR-кодом',
    scanData: 'Данные QR-кода',
    readData: 'Данные из картинки',
    nextButton: 'Вперед {0}',
    no: 'нет',
    yes: 'да',
    shareUrlNotice: 'Ссылка на 3D',

    file: 'файл',
    content: 'контент',
    remove: 'Удалить',
    close: 'Закрыть',
  },

  /**
   * Template
   */
  t: {
    exampleButton: 'Смотреть примеры',
    discussionButton: 'Обсудить',
    setting: 'Настроить',
    create: 'Создать',
    check: 'Проверить',
    download: 'Скачать',
  },

  /**
   * Form
   */
  form: {
    scanQRButton: 'Сканировать QR-код',
    readQRButton: 'Распознать QR-код',
    optionsTitle: 'Настройки 3D модели',
    min: 'min',
    max: 'max',
    width: 'Ширина',
    height: 'Высота',
    depth: 'Глубина',
    margin: 'Отступ',
    size: 'Размер',
    top: 'сверху',
    bottom: 'снизу',
    left: 'слева',
    right: 'справа',
    errorCorrection: 'Уровень коррекции ошибки увеличен при использовании иконки.',
    base: {
      title: 'Основа',
      active: 'Основной слой',
      activeLabel: 'Другие слои используют данные основы, даже если отключить.',
      cornerRadius: 'Радиус угла',
    },
    qr: {
      active: 'QR',
      activeLabel: 'Настройка для QR-кода.',
      placeholder: 'Текст для QR кода.\nНапример - vsqr.ru',
      correction: {
        title: 'Коррекция ошибки',
        label: 'Чем выше уровень коррекции ошибок, тем плотнее QR-код.',
        l: 'L (Низкий, 7% лишних)',
        m: 'M (Средний, 15% лишних)',
        q: 'Q (Четверть, 25% лишних)',
        h: 'H (Высокий, 30% лишних)',
      },
      emptyCenter: 'Пустой центр',
      emptyCenterHelp: 'Убирает блоки из центра, если добавлена иконка',
      correctionLabel: '',
      blockSize: 'Размер блока',
      blockSizeLabel: `
  90% оставляет зазор между черными блоками, а 105% соединяет черные блоки и упрощает печать.
  Перед печатью надо отсканировать и убедиться, что все работает, как надо.
  Если не уверен, можно оставить 100%`,
      blockShape: {
        title: 'Форма блока',
        classic: 'Классика',
        rhombus: 'Ромб',
        round: 'Круг',
      },
      cityMode: 'QR-город',
      cityModeLabel: 'Случайная высота черных блоков.',
      content: {
        wifi: {
          ssid: 'Название Wifi сети',
          password: 'Пароль',
          passwordPlaceholder: 'Пароль Wifi сети',
          security: 'Безопасность',
          hidden: 'Скрыть',
          hiddenText: 'Скрывает SSID',
        },
        email: {
          recipient: 'Получатель',
          recipientPlaceholder: 'Адрес, на который должна приходить почта',
          subject: 'Тема',
          subjectPlaceholder: 'Тема электронного письма',
          body: 'Сообщение',
          bodyPlaceholder: 'Текст сообщения электронного письма',
        },
        contact: {
          contact: 'Контакты',
          yourName: 'ФИО',
          firstname: 'Имя',
          lastname: 'Фамилия',
          organization: 'Организация',
          organizationPlaceHolder: 'ООО vsqr',
          role: 'Должность',
          rolePlaceHolder: 'Главный генератор',
          numbers: 'Номера',
          cellphone: 'Мобильный',
          phone: 'Телефон',
          faxPlaceHolder: 'факс',
          emailPlaceHolder: 'email@mail.ru',
          street: 'Улица',
          streetPlaceHolder: 'ул. Ленина',
          city: 'Город',
          postcodePlaceHolder: '123456',
          cityPlaceHolder: 'г. Москва',
          state: 'Штат',
          statePlaceHolder: '',
          countryPlaceHolder: 'Россия',
          sitePlaceHolder: 'vsqr.ru',
        },
        sms: {
          phone: 'Телефон',
          phonePlaceholder: 'Номер получателя',
          message: 'Сообщение',
          messagePlaceholder: 'Текст SMS сообщения',
        },
      },
    },
    text: {
      active: 'Текст',
      activeLabel: 'Добавить текст.',
      placeholder: 'Обычный\n*Курсив*\n**Жирный**\n***Жирный курсив***',
      textLabel: 'Для каждой строки:',
      italic: '*курсив*',
      bold: '**жирный**',
    },
    border: {
      active: 'Рамка',
      activeLabel: 'Добавить рамку на основу.',
    },
    keychain: {
      active: 'Брелок',
      activeLabel: 'Добавить отверстие.',
      placement: 'Расположить',
      mirror: 'Зеркально',
      mirrorLabel: 'Отразить зеркально.',
      holeDiameter: 'Диаметр',
    },
    icon: {
      title: 'Иконки',
      active: 'Иконка',
      activeLabel: 'Выбрать иконку или указать свой svg.',
      select: 'Выбрать',
      noIcon: 'Без иконки',
      custom: 'Свой SVG',
      sizeLabel: `
  Размер иконки относительно общей ширины базовой модели.
  Слишком большой значок может сделать QR-код нечитаемым.`,
      inverted: 'Инвертировать',
      offsetX: 'Сдвинуть по горизонтали',
      offsetY: 'Сдвинуть по вертикали',
    },
    magnet: {
      active: 'Углубление',
      activeLabel: 'Добавить углубление для магнита или NFC-метки с обратной стороны модели.',
      hidden: 'Спрятать',
      hiddenHelp: 'Сдвигает на 0.6 мм по Z',
      shape: 'Форма',
      square: 'квадрат',
      round: 'круг',
    },
  },

  /**
   * Export
   */
  e: {
    title: 'Настройки экспорта',
    buttonStl: 'Скачать STL',
    buttonObj: 'Скачать OBJ',
    buttonPng: 'PNG',
    downloadHistory: 'История загрузок',
    downloadAll: 'Скачано всего',

    loadItem: 'Загрузить',
    typeLabel: 'Тип файла',
    multipleLabel: 'По частям',

    generateHistory: 'История сгенерированных моделей',
    helpHistory: 'История сгенерированных моделей доступна в пределах одной вкладки не более {0} шт.',

    modalTitle: 'Экспорт STL',
    downloadStart: 'Загрузка начнется через {0} сек.',
    downloadStarted: 'Загрузка началась.',
    motivationText: 'Сейчас легко и просто можно денежно поддержать проект. Например этот.',
    thankYouSupport: 'Спасибо за поддержку и использование проекта.',

    exampleButton: 'Смотреть примеры',
  },

  /**
   * Monetization
   */
  m: {
    supportProject: 'Поддержать проект',
    thankYou: 'Спасибо.',
  },


  /**
   * Share
   */
  s: {
    modalTitle: 'Поделись ссылкой на 3d модель',
    modalBody: 'Скопируй ссылку из адресной строки, там хранятся настройки 3d модели. Попробуй сократить ссылку через сервис сокращения',
    shortLinkLabel: 'Короткая ссылка на эту страницу',
    shortServiceLabel: 'clck.ru от Yandex',

    email: 'Отправить электронную почту',
    telegram: 'Отправить в телеграм',
    vk: 'Поделиться вконтакте',
    ok: 'Поделиться в одноклассники',
    facebook: 'Поделиться в фейсбук',
    instagram: '',
    linkedin: '',
    whatsapp: '',
    twitter: 'Твитнуть',
    tiktok: '',
    reddit: 'Отправить в реддит',
    pinterest: 'Закрепить это',
    pocket: 'Добавить в покет',
    copyLink: 'Скопировать ссылку',
  },

};
