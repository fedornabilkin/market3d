<template lang="pug">
  .dropdown.is-hoverable
    .dropdown-trigger
      button.button(aria-haspopup='true' aria-controls='dropdown-menu')
        span
          img(:src="'/flags/gif/' + currentLocale + '.gif'" :alt='currentLocale')
        span.icon.is-small
          i.fas.fa-angle-down(aria-hidden='true')
    #dropdown-menu.dropdown-menu(role='menu')
      .dropdown-content
        a.dropdown-item(v-for='locale in locales' :key='locale' @click='changeLanguage(locale)')
          img(:src="'/flags/gif/' + locale + '.gif'" :alt='locale')
          |  {{ $i18n.messages[locale]['name'] }}
</template>

<script>
export default {
  name: 'LanguageSelector',
  data() {
    return {
      currentLocale: this.$i18n.locale,
      locales: this.$i18n.availableLocales,
    };
  },
  methods: {
    changeLanguage(locale) {
      this.$i18n.locale = locale;
      this.currentLocale = locale;
      window.localStorage.setItem('locale', locale);
      return false;
    },
  },
};
</script>

<style>

</style>
