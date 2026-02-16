export default {

  name: 'English',

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
    title: '3D Generator STL',
    subtitle: 'Export QR code or text in STL format for 3D printing',
    preview: 'Preview',
    controlsHint: 'Can be rotated',
    autoRotation: 'Auto-rotate',
    generateButton: 'Create 3D model',
    historyButton: 'History',
    scanModalTitle: 'The code must be in front of the camera',
    readModalTitle: 'Load QR code from file',
    scanData: 'QR code data',
    readData: 'Data from image',
    nextButton: 'Next {0}',
    no: 'no',
    yes: 'yes',
    shareUrlNotice: 'Link to 3D',

    file: 'файл',
    content: 'контент',
    remove: 'Remove',
    close: 'Close',
  },

  /**
   * Template
   */
  t: {
    exampleButton: 'See examples',
    discussionButton: 'Discuss',
    setting: 'Setting',
    create: 'Create',
    check: 'Check',
    download: 'Download',
  },

  /**
   * Form
   */
  form: {
    scanQRButton: 'Scan QR code',
    readQRButton: 'Read QR code',
    optionsTitle: '3D model settings',
    min: 'min',
    max: 'max',
    width: 'Width',
    height: 'Height',
    depth: 'Depth',
    margin: 'Margin',
    size: 'Size',
    top: 'top',
    bottom: 'bottom',
    left: 'left',
    right: 'right',
    errorCorrection: 'The error correction level has been increased when using the icon.',
    base: {
      title: 'Base',
      active: 'Base layer',
      activeLabel: 'Other layers use these bases even if disabled.',
      cornerRadius: 'Corner radius',
    },
    qr: {
      active: 'QR',
      activeLabel: 'QR setting.',
      placeholder: 'Text for QR code.\nFor example - vsqr.ru',
      correction: {
        title: 'Error correction',
        label: 'The higher the error correction level, the denser the QR code.',
        l: 'L (Low, 7% redundant)',
        m: 'M (Medium, 15% redundant)',
        q: 'Q (Quartile, 25% redundant)',
        h: 'H (High, 30% redundant)',
      },
      emptyCenter: 'Empty center',
      emptyCenterHelp: 'Removes blocks from the center if an icon is added',
      correctionLabel: '',
      blockSize: 'Block size',
      blockSizeLabel: `
  90% оставляет зазор между черными блоками, а 105% соединяет черные блоки и упрощает печать.
  Перед печатью надо отсканировать и убедиться, что все работает, как надо.
  Если не уверен, можно оставить 100%`,
      blockShape: {
        title: 'Block shape',
        classic: 'Classic',
        rhombus: 'Rhombus',
        round: 'Round',
      },
      cityMode: 'QR-city',
      cityModeLabel: 'Random height of black blocks.',
      content: {
        wifi: {
          ssid: 'Wifi network name',
          password: 'Password',
          passwordPlaceholder: 'Wifi network password',
          security: 'Security',
          hidden: 'Hide',
          hiddenText: 'Hides SSID',
        },
        email: {
          recipient: 'Recipient',
          recipientPlaceholder: 'The address to which mail should be sent',
          subject: 'Subject',
          subjectPlaceholder: 'Email subject',
          body: 'Message',
          bodyPlaceholder: 'Email message text',
        },
        contact: {
          contact: 'Contact',
          yourName: 'Full name',
          firstname: 'Name',
          lastname: 'Surname',
          organization: 'Organization',
          organizationPlaceHolder: 'vsqr',
          role: 'Job title',
          rolePlaceHolder: 'Main generator',
          numbers: 'Numbers',
          cellphone: 'Mobile',
          phone: 'Phone',
          faxPlaceHolder: 'fax',
          emailPlaceHolder: 'email@mail.ru',
          street: 'Street',
          streetPlaceHolder: 'Lenin st.',
          city: 'City',
          postcodePlaceHolder: '123456',
          cityPlaceHolder: 'Moscow',
          state: 'State',
          statePlaceHolder: '',
          countryPlaceHolder: 'Russia',
          sitePlaceHolder: 'vsqr.ru',
        },
        sms: {
          phone: 'Phone',
          phonePlaceholder: 'Recipient number',
          message: 'Message',
          messagePlaceholder: 'SMS text message',
        },
      },
    },
    text: {
      active: 'Text',
      activeLabel: 'Add text.',
      placeholder: 'Regular\n*Italic*\n**Bold**\n***Bold italic***',
      textLabel: 'For each line:',
      italic: '*italic*',
      bold: '**bold**',
    },
    border: {
      active: 'Frame',
      activeLabel: 'Add a frame to the base.',
    },
    keychain: {
      active: 'Keychain',
      activeLabel: 'Add hole.',
      placement: 'Placement',
      mirror: 'Mirror',
      mirrorLabel: 'Mirror placement.',
      holeDiameter: 'Diameter',
    },
    icon: {
      title: 'Icons',
      active: 'Icon',
      activeLabel: 'Select an icon or specify your own svg.',
      select: 'Select',
      noIcon: 'No icon',
      custom: 'Your SVG',
      sizeLabel: `
  The size of the icon relative to the overall width of the base model.
  Too large an icon can make the QR code unreadable.`,
      inverted: 'Invert',
      offsetX: 'Move horizontally',
      offsetY: 'Move vertically',
    },
    magnet: {
      active: 'Deepening',
      activeLabel: 'Add a recess for a magnet or NFC tag on the back of the model.',
      hidden: 'Hide',
      hiddenHelp: 'Move 0.6 мм to Z',
      shape: 'Shape',
      square: 'square',
      round: 'round',
    },
  },

  /**
   * Export
   */
  e: {
    title: 'Export settings',
    buttonStl: 'Download STL',
    buttonObj: 'Download OBJ',
    buttonPng: 'PNG',
    downloadHistory: 'Download history',
    downloadAll: 'Download all',

    loadItem: 'Load',
    typeLabel: 'Type',
    multipleLabel: 'Multi',

    generateHistory: 'History of generated models',
    helpHistory: 'The history of generated models is available within one tab, no more than {0} pcs.',

    modalTitle: 'Export STL',
    downloadStart: 'Download will start in {0} sec.',
    downloadStarted: 'Download has started.',
    motivationText: 'Now it is easy and simple to support a project financially. For example this one.',
    thankYouSupport: 'Thank you for your support and use of the project.',

    exampleButton: 'See examples',
  },

  /**
   * Monetization
   */
  m: {
    supportProject: 'Support project',
    thankYou: 'Thank you.',
  },


  /**
   * Share
   */
  s: {
    modalTitle: 'Share a link to the 3d model',
    modalBody: 'Copy the link from the address bar, the 3D model settings are stored there. Try shortening the link using a shortening service',
    shortLinkLabel: 'Short link to this page',
    shortServiceLabel: 'clck.ru from Yandex',

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
