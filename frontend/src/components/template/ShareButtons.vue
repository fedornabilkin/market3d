<script setup>
const url = 'https://vsqr.ru'
const title = 'STL генератор QR кодов для 3d печати.'
const text = 'Создать QR-код для 3d печати в формате STL.'
const imageUrl = 'https://vsqr.ru/android-chrome-192x192.png'
const fullText = `${text}: ${url}`
const twitterHandle = 'fedornabilkin'

// https://yandex.ru/dev/share/
const socials = {
  telegram: {
    href: `https://telegram.me/share/url?url=${encodeURIComponent(url)}&text=${encodeURIComponent(text)}`,
    icon: 'fab fa-telegram',
    title: 's.telegram',
    reader: 's.telegram',
  },
  vk: {
    href: `https://vk.com/share.php?url=${encodeURIComponent(url)}`,
    icon: 'fab fa-vk',
    title: 's.vk',
    reader: 's.vk',
  },
  ok: {
    href: `https://connect.ok.ru/offer?url=${encodeURIComponent(url)}&title=${encodeURIComponent(title)}&imageUrl=${encodeURIComponent(imageUrl)}`,
    icon: 'fab fa-odnoklassniki',
    title: 's.ok',
    reader: 's.ok',
  },
  facebook: {
    href: `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}&quote=${encodeURIComponent(fullText)}`,
    icon: 'fab fa-facebook-square',
    title: 's.facebook',
    reader: 's.facebook'
  },
  instagram: {
    href: '',
    icon: '',
    title: '',
    reader: '',
  },
  linkedin: {
    href: '',
    icon: '',
    title: '',
    reader: '',
  },
  whatsapp: {
    href: '',
    icon: '',
    title: '',
    reader: '',
  },
  twitter: {
    // href: `https://twitter.com/intent/tweet?source=${encodeURIComponent(url)}&text=${encodeURIComponent(fullText)}&via=${twitterHandle}`,
    href: `https://twitter.com/intent/tweet?source=${encodeURIComponent(url)}&text=${encodeURIComponent(fullText)}`,
    icon: 'fab fa-twitter-square',
    title: 's.twitter',
    reader: 's.twitter'
  },
  tiktok: {
    href: '',
    icon: '',
    title: '',
    reader: '',
  },
  reddit: {
    href: `http://www.reddit.com/submit?url=${encodeURIComponent(url)}&title=${encodeURIComponent(text)}`,
    icon: 'fab fa-reddit-square',
    title: 's.reddit',
    reader: 's.reddit'
  },
  pinterest: {
    href: `http://pinterest.com/pin/create/button/?url=${encodeURIComponent(url)}&media=${encodeURIComponent(imageUrl)}&description=${encodeURIComponent(text)}`,
    icon: 'fab fa-pinterest-square',
    title: 's.pinterest',
    reader: 's.pinterest'
  },
  pocket: {
    href: `https://getpocket.com/save?url=${encodeURIComponent(url)}&title=${encodeURIComponent(title)}`,
    icon: 'fab fa-get-pocket',
    title: 's.pocket',
    reader: 's.pocket'
  },
  email: {
    href: `mailto:?subject=${encodeURIComponent(title)}&body=${encodeURIComponent(fullText)}`,
    icon: 'fas fa-envelope-square',
    title: 's.email',
    reader: 's.email'
  },
}

const isActive = (key) => {
  const enable = ['telegram', 'vk', 'ok', 'email']
  return enable.includes(key)
}

const actual = []
for (const key in socials) {
  if (isActive(key, socials[key])) {
    actual.push(socials[key])
  }
}

</script>

<template lang="pug">
  ul.share-buttons
    li(v-for="item in actual")
      a(:href="item.href" target='_blank' :title="$t(item.title)")
        i.fa-2x(aria-hidden='true' :class="item.icon")
        span.sr-only {{ $t(item.reader) }}
</template>

<style scoped>
ul.share-buttons {
  list-style: none;
  padding: 0;
}

ul.share-buttons li {
  display: inline;
  margin: 0 5px;
}

ul.share-buttons li a {
  color: #363636;
}

ul.share-buttons li a:hover {
  color: #4a4a4a;
}

ul.share-buttons .sr-only {
  position: absolute;
  clip: rect(1px 1px 1px 1px);
  clip: rect(1px, 1px, 1px, 1px);
  padding: 0;
  border: 0;
  height: 1px;
  width: 1px;
  overflow: hidden;
}
</style>
