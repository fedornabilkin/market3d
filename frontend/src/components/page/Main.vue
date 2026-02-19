<template lang="pug">
.container
  .hero-section
    h1.title.is-1 {{ $t('g.title') }}
    h2.subtitle.is-4 {{ $t('g.subtitle') }}
    router-link.button.is-primary.is-large(:to="{ name: 'GeneratorQR' }")
      span.icon
        i.fa.fa-cube
      span {{ $t('g.goToGenerator') }}

  .examples-section
    h2.title.is-3 Примеры моделей
    el-carousel(
      ref="carouselRef"
      :interval="4000"
      :autoplay="true"
      :loop="true"
      :pause-on-hover="true"
      arrow="always"
      height="500px"
    )
      el-carousel-item(v-for="slide in slides" :key="slide.id")
        .slide-content
          .slide-image
            img(:src="slide.imageSrc" :alt="slide.imageAlt")
          .slide-description
            p {{ slide.description }}
          .slide-settings(v-if="slide.settingsJson && false")
            details
              summary Настройки модели (JSON)
              pre {{ JSON.stringify(slide.settingsJson, null, 2) }}

</template>

<script>
import { ref } from 'vue';
import PaymentMethodsButton from "@/components/monetisation/PaymentMethodsButton.vue";
import SponsorList from "@/components/monetisation/SponsorList.vue";

export default {
  name: 'Main',
  components: {
    SponsorList,
    PaymentMethodsButton,
  },
  setup() {
    const carouselRef = ref(null);

    const slides = [
      {
        id: 'qr1',
        imageSrc: '/example/base-qr-text-frame.png',
        imageAlt: '3d модель qr-кода с подписью',
        description: 'QR-код в котором закодирован адрес сайта. Подпись добавлена на случай, если нет возможности отсканировать qr-код.',
        settingsJson: {
          base: { width: 22, height: 22, cornerRadius: 8 },
          code: { active: true, errorCorrectionLevel: 'H' },
          text: { active: true, message: 'vsqr.ru', height: 8 },
          border: { active: true }
        }
      },
      {
        id: 'key1',
        imageSrc: '/example/base-text-key-frame.png',
        imageAlt: 'Брелок 3д для ключей с надписью',
        description: 'Брелок для ключей с надписью. Можно добавить свое имя, крутую надпись или номер телефона. Отверстие слева.',
        settingsJson: {
          base: { width: 22, height: 22, cornerRadius: 8 },
          text: { active: true, message: 'Ваш текст', height: 8 },
          keychain: { active: true, placement: 'topLeft' },
          border: { active: true }
        }
      },
      {
        id: 'key2',
        imageSrc: '/example/base-icon-key-frame.png',
        imageAlt: 'Брелок 3д для ключей с иконкой',
        description: 'Брелок для ключей с иконкой. Размер иконки обычно 85-90% от базового размера. Отверстие сверху слева и рамка толщиной в 1 мм.',
        settingsJson: {
          base: { width: 22, height: 22, cornerRadius: 8 },
          icon: { active: true, name: 'globe', ratio: 85 },
          keychain: { active: true, placement: 'topLeft' },
          border: { active: true }
        }
      },
      {
        id: 'key3',
        imageSrc: '/example/base-icon-text-key-frame.png',
        imageAlt: 'Брелок с иконкой и текстом 3д',
        description: 'Брелок с иконкой и текстом. Размер иконки обычно 18-20% от базового размера. Ваш текст или слоган. Отверстие слева и рамка.',
        settingsJson: {
          base: { width: 22, height: 22, cornerRadius: 8 },
          icon: { active: true, name: 'globe', ratio: 18 },
          text: { active: true, message: 'Ваш текст', height: 8 },
          keychain: { active: true, placement: 'topLeft' },
          border: { active: true }
        }
      },
      {
        id: 'key4',
        imageSrc: '/example/base-text-key.jpg',
        imageAlt: '3д бирка для гардероба с петелькой и текстом',
        description: 'Бирка в гардероб с надписью. Увеличить диаметр и толщину петельки, разместить сверху. Добавить длину петельке или высоту базовой фигуре',
        settingsJson: {}
      },
      {
        id: 'box1',
        imageSrc: '/example/base-border-box.jpg',
        imageAlt: 'Ящик для мелочей 3д',
        description: 'Небольшой простой ящик для мелочей. База и рамка высотой в 30 мм. Толщина базы не менее 2 мм для прочности',
        settingsJson: {}
      }
    ];

    return {
      slides,
      carouselRef,
    };
  },
}
</script>

<style scoped>
.hero-section {
  text-align: center;
  padding: 3rem 0;
  margin-bottom: 3rem;
}

.hero-section .title {
  margin-bottom: 1rem;
}

.hero-section .subtitle {
  margin-bottom: 2rem;
}

.examples-section {
  margin-bottom: 3rem;
}

.examples-section .title {
  text-align: center;
  margin-bottom: 2rem;
}

.slide-content {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 2rem;
  height: 100%;
}

.slide-image {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 1rem;
}

.slide-image img {
  max-width: 100%;
  max-height: 400px;
  object-fit: contain;
}

.slide-description {
  text-align: center;
  margin-bottom: 1rem;
  max-width: 600px;
}

.slide-description p {
  font-size: 1.1rem;
  line-height: 1.6;
}

.slide-settings {
  width: 100%;
  max-width: 600px;
}

.slide-settings details {
  cursor: pointer;
  margin-top: 1rem;
}

.slide-settings summary {
  padding: 0.5rem;
  background-color: #f5f5f5;
  border-radius: 4px;
}

.slide-settings pre {
  background-color: #f9f9f9;
  padding: 1rem;
  border-radius: 4px;
  overflow-x: auto;
  font-size: 0.9rem;
  margin-top: 0.5rem;
}

@media screen and (max-width: 768px) {
  .hero-section {
    padding: 2rem 0;
  }

  .slide-content {
    padding: 1rem;
  }

  .slide-image img {
    max-height: 250px;
  }
}
</style>
