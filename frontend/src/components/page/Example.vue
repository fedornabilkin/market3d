<script setup>
import CardExample from "@/components/example/CardExample.vue";

const items = {
  qr1: {
    url: 'https://clck.ru/3GwBgK',
    img: {
      src: '/example/base-qr-text-frame.png',
      alt: '3d модель qr-кода с подписью'
    },
    text: 'QR-код в котором закодирован адрес сайта. Подпись добавлена на случай, если нет возможности отсканировать qr-код.',
    tags: [
      'Основа',
      'QR-код',
      'Текст',
      'Рамка',
    ]
  },
  key1: {
    url: 'https://clck.ru/3Gw9ia',
    img: {
      src: '/example/base-text-key-frame.png',
      alt: ''
    },
    text: 'Брелок для ключей с надписью. Можно добавить свое имя, крутую надпись или номер телефона. Отверстие слева.',
    tags: [
      'Основа',
      'Текст',
      'Отверстие',
      'Рамка',
    ]
  },
  key2: {
    url: '/#share-eyJiYXNlIjp7IndpZHRoIjoyMiwiaGVpZ2h0IjoyMiwiY29ybmVyUmFkaXVzIjo4fSwiYm9yZGVyIjp7ImFjdGl2ZSI6dHJ1ZX0sImNvZGUiOnsiZXJyb3JDb3JyZWN0aW9uTGV2ZWwiOiJIIiwicHJldmlldyI6eyJzcmMiOiJkYXRhOmltYWdlL3BuZztiYXNlNjQsaVZCT1J3MEtHZ29BQUFBTlNVaEVVZ0FBQUZ3QUFBQmNDQVlBQUFEajc5SllBQUFBQVhOU1IwSUFyczRjNlFBQUE0UkpSRUZVZUY3dG5jdHl3eUFRQk9QLy8yaW5LamVqS25XNkJyQmtUNjdMWStsZEJnU1M4M2crbjgrZi9tMGo4Q2p3YmF6L09pcnd2YndMZkRQdkkvREg0N0hWQjFwQ3JEK3oyMHRoalA0Y0pNVU9jTFpEWTN2V253S0hpTXdHTkx1OTJRblZERStKeW9SQzRKUXgxdDlSSWc0YU42d2h1KzEyUENTQldzTUwzSVVBRTJwODhLRUtydnRqYVdyLzNmYmw0eXZ3dVNjYm1EQVdlTHBOUTRma2M4QnFqYWVNMS8wWCtHdUdMMCtvQWk5d21zVXZkajJsNWJhVG5OSDkzeTNEYVlBaklDcFA5Z0lmN2t0SWN3a28yUXU4d005emdES0k3RllpYkhuYmY5eisxVFdjZ0t5MmY1MmtyQVpLN1JlNDNOWVJVTElYK0xjQnA0aVQzWjZsN0Q0ZUp2L0pqdU96aXlaMVNIWjBDREtZMmljNzlVLzF5VTd0Mys3R2h3Wk1kZ0pDOWNsTzdSZjQ1RGY5WXVBVTBkUk91NFRWOXRSL3FxL3ZOS25CMUw0YUtMV2Yray8xQzF6ZUtCRlFzaGY0MVlCVHhIYmJhUkVhL2JIbHQ0L242dStIVzRDMmZJRVBCQ3hBVzc3QUMveVZnTTBndWdMYm5XR3J0NGwwOXFNL09Tbnc4eFFwOElGUE0zeXpwdHdlK01pTEJrUlR6dTZyU2VMSVR2R20rclJHNFpPbWRhREF6ejlDSzNCNUhOc01oeGVCM2kxcE9PUHRvejFwRm5ZSWgwZXB4cE1rMnZhcFBiM21GTGhGZWw0ZUphakFDMXdSU0NWT2RmYVB3dE16blBxa0RyWG15ZGNtMGdCUS9YUlIxbWNwQlg3K2lRb3R5Z1crK0gzenc0eTJpMll6ZkhPR3B4cE4rM1FLYUdwUC9TY05wL0ZwU1VrZEpvZFNvRlEvOWIvQWlmQmdMM0I1bUNUNUhvcmZEbmc2WUtxZkFxSDJyYVNSUDNyZlBudVhZZ2RzSDRTb3ZPMGY5ODN5aXdzS3FGNDA3WUJzZWNxb0FyZEVvZnpYQVNkTm1zejNKOTFta1Q4VVFCb3YrYWZ0OUkwUERTaTFrOE9raWRSL2dRK0VDdnpkNzA4dnZvSkxBMnhuRE43YVU0TTBoY2xPN2FkMjJ6OUpGdmxEdTZZQ2x6T293T1VORUdWZ00xdysyZEdUNHUyQjA3NTFkc2JNQmtZYWJ3Tkkvc1VhWHVEbklTUE4xNTkrRjNpQnZ4Q3crMnlTUUpLZ1NvcThoU2VncWFZZkFrSm5LYk16aGpTT0FKQ2twZjdPenZnQ3A0akNXWStzZmlqZVJSTUlmcnlrekpZTWtoaXlrOFJvZjYrbTRYb0FrODlHbHZkZjRPNzN3K01aVWVBWEJ4NnYwdkswajZhNDFWaTdDS2JiMkhoYldPRFpmMFhSMjhJQ0wzQjFsbko1U1Vrem11b1RnTjBhbm1vMjFVZEpJV0NwdmNEZi9Kb0VIWGRTZ0dtZmJBTk01Y2xmZmVOREEwenROS0NQbDVRVVlPdWZFN2pjNjhxZkhyQUMzeHpoQXQ4TS9CZkNFZmRIQ1VCRVd3QUFBQUJKUlU1RXJrSmdnZz09In19LCJ0ZXh0Ijp7Im1lc3NhZ2UiOiJ2c3FyIiwiaGVpZ2h0Ijo4fSwiaWNvbiI6eyJhY3RpdmUiOnRydWUsIm5hbWUiOiJnbG9iZSIsInJhdGlvIjo4NSwic3JjIjoiPHN2ZyB4bWxucz1cImh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnXCIgYXJpYS1oaWRkZW49XCJ0cnVlXCIgZm9jdXNhYmxlPVwiZmFsc2VcIiBkYXRhLXByZWZpeD1cImZhc1wiIGRhdGEtaWNvbj1cImdsb2JlXCIgY2xhc3M9XCJzdmctaW5saW5lLS1mYSBmYS1nbG9iZSBmYS13LTE2XCIgcm9sZT1cImltZ1wiIHZpZXdCb3g9XCIwIDAgNDk2IDUxMlwiPjxwYXRoIGZpbGw9XCJjdXJyZW50Q29sb3JcIiBkPVwiTTMzNi41IDE2MEMzMjIgNzAuNyAyODcuOCA4IDI0OCA4cy03NCA2Mi43LTg4LjUgMTUyaDE3N3pNMTUyIDI1NmMwIDIyLjIgMS4yIDQzLjUgMy4zIDY0aDE4NS4zYzIuMS0yMC41IDMuMy00MS44IDMuMy02NHMtMS4yLTQzLjUtMy4zLTY0SDE1NS4zYy0yLjEgMjAuNS0zLjMgNDEuOC0zLjMgNjR6bTMyNC43LTk2Yy0yOC42LTY3LjktODYuNS0xMjAuNC0xNTgtMTQxLjYgMjQuNCAzMy44IDQxLjIgODQuNyA1MCAxNDEuNmgxMDh6TTE3Ny4yIDE4LjRDMTA1LjggMzkuNiA0Ny44IDkyLjEgMTkuMyAxNjBoMTA4YzguNy01Ni45IDI1LjUtMTA3LjggNDkuOS0xNDEuNnpNNDg3LjQgMTkySDM3Mi43YzIuMSAyMSAzLjMgNDIuNSAzLjMgNjRzLTEuMiA0My0zLjMgNjRoMTE0LjZjNS41LTIwLjUgOC42LTQxLjggOC42LTY0cy0zLjEtNDMuNS04LjUtNjR6TTEyMCAyNTZjMC0yMS41IDEuMi00MyAzLjMtNjRIOC42QzMuMiAyMTIuNSAwIDIzMy44IDAgMjU2czMuMiA0My41IDguNiA2NGgxMTQuNmMtMi0yMS0zLjItNDIuNS0zLjItNjR6bTM5LjUgOTZjMTQuNSA4OS4zIDQ4LjcgMTUyIDg4LjUgMTUyczc0LTYyLjcgODguNS0xNTJoLTE3N3ptMTU5LjMgMTQxLjZjNzEuNC0yMS4yIDEyOS40LTczLjcgMTU4LTE0MS42aC0xMDhjLTguOCA1Ni45LTI1LjYgMTA3LjgtNTAgMTQxLjZ6TTE5LjMgMzUyYzI4LjYgNjcuOSA4Ni41IDEyMC40IDE1OCAxNDEuNi0yNC40LTMzLjgtNDEuMi04NC43LTUwLTE0MS42aC0xMDh6XCIvPjwvc3ZnPiJ9LCJrZXljaGFpbiI6eyJhY3RpdmUiOnRydWUsInBsYWNlbWVudCI6InRvcExlZnQifSwiY29udGVudCI6InF3ZXJ0eSJ9',
    img: {
      src: '/example/base-icon-key-frame.png',
      alt: ''
    },
    text: 'Брелок для ключей с иконкой. Размер иконки обычно 85-90% от базового размера. Отверстие сверху слева и рамка толщиной в 1 мм.',
    tags: [
      'Основа',
      'Иконка',
      'Отверстие',
      'Рамка',
    ]
  },
  key3: {
    url: 'https://clck.ru/3Lx7dA',
    img: {
      src: '/example/base-icon-text-key-frame.png',
      alt: ''
    },
    text: 'Брелок с иконкой и текстом. Размер иконки обычно 18-20% от базового размера. Ваш текст или слоган. Отверстие слева и рамка.',
    tags: [
      'Основа',
      'Иконка',
      'Текст',
      'Отверстие',
      'Рамка',
    ]
  },
}
</script>

<template lang="pug">
  .container.is-fluid
    .box
      h1.title.is-2 Примеры STL моделей 3d
      p.subtitle.is-4 Примеры 3д моделей демонстрируют возможности генератора.

      .columns
        .column.is-half
          article.message
            .message-body
              | Современный тренд: QR-код на 3d принтере. Квадратная или прямоугольная карточка с вашим QR-кодом. Закодировать можно любую информацию и добавить подпись по желанию.
          p Создайте свою 3D-модель QR-кода с помощью нашего онлайн-генератора STL. Просто введите информацию и настройте основные параметры, и мы создадим для вас уникальную 3D-модель QR-кода. Загрузите STL-файл и распечатайте его на 3D-принтере.

    .columns
      .column.is-one-third
        article.card
          .card-header
            p.card-header-title Что можно закодировать
          .card-content
            .content
              ul
                li Номер телефона
                li Ссылку на сайт
                li Ссылку на страницу оплаты
                li Ссылки на страницы в социальных сетях
                li Почтовый адрес
                li Адрес электронной почты
                li Код оплаты СБП (для магазинов)
                li ИНН, СНИЛС, номер паспорта
                li WIFI (кафе, ресторан)
                li Памятное событие
      .column.is-one-third
        article.card
          .card-header
            p.card-header-title Где использовать
          .card-content
            .content
              ul
                li В автомобиль под стекло
                li Брелок на ключи
                li Ребкнку в карман
                li Пожилым людям в карман
                li Курьерам
                li Животным на ошейник
                li Рекламная акция или информирование
                li Оригинальный подарок
      .column.is-one-third
        article.card
          .card-header
            p.card-header-title Для чего кодировать в QR-код
          .card-content
            .content
              ul
                li Мгновенный перенос данных в телефон
                li Надежный физический носитель данных
                li Много информации в небольшом формате

    .box
      h2.title.is-4 Как создать 3d модель с помощью STL генератора
      p Выберите один из предложенных вариантов. Нажмите на ссылку, соответствующую выбранному примеру. В открывшемся окне скорректируйте информацию, которую хотите разместить на QR-коде и укажите необходимые настройки при необходимости. Сгенерируйте и скачайте STL-файл 3D модели.
      p Перед тем, как загрузиить файл, обязательно изучите получившуюся модель в окне предварительного просмотра. 3d  модель можно приблизить и повернуть для просмотра с разных сторон.

      article.message.is-info.mt-2
       .message-body
         p Установите радиус угла, чтобы получить круглый QR код с помощью этого генератора.
         p Укажите глубину рамки 2 мм, чтобы она была выше текста и QR-кода.

    .columns.is-desktop
      .column(v-for="item in items")
        CardExample(:item="item")
</template>

<style scoped>

</style>
