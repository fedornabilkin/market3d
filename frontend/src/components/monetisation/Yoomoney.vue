<script setup>
import {ref} from "vue"

const showingThankYou = ref(false)
</script>

<template lang="pug">
  .boxb.b
    a.button(
      v-if="!showingThankYou"
      href="https://yoomoney.ru/fundraise/1ET4AORVPH6.251226"
      target="_blank"
      @click="showingThankYou=true"
    )
      span.icon
        i.fa.fa-credit-card
      span {{ $t('m.supportProject') }}

    a.button.is-danger(
      v-if="showingThankYou"
      href="https://yoomoney.ru/fundraise/1ET4AORVPH6.251226"
      target="_blank"
    )
      span.icon
        i.fa.fa-heart
      span {{ $t('m.thankYou') }}
</template>

<style>
/*
https://xsgames.co/animatiss
https://cssreference.io/
https://cssmasterclass.io/
https://jgthms.com/web-design-in-4-minutes

https://codepen.io/nocksock/pen/zYQVmwG?editors=1100
*/
.jello-horizontal{
  animation:jello-horizontal 10s linear both;
  animation-iteration-count: infinite;
  animation-delay: 3s;
}
@keyframes jello-horizontal{
  0%{transform:scale3d(1,1,1)}
  3%{transform:scale3d(1.25,.75,1)}
  4%{transform:scale3d(.75,1.25,1)}
  5%{transform:scale3d(1.15,.85,1)}
  6%{transform:scale3d(.95,1.05,1)}
  7%{transform:scale3d(1.05,.95,1)}
  100%{transform:scale3d(1,1,1)}
}

.boxb a.button {
  border-radius: .6rem;
  border-color: white;
  box-shadow: none;
}

.boxb {
  --border-angle: 0deg;
  border-radius: .6rem;
  display: inline-block;
  justify-content: center;
  align-items: center;
  box-shadow: 0px 2px 4px hsl(0 0% 0% / 25%);
  animation: border-angle-rotate 4s infinite linear;
  border: .1rem solid transparent;
  position: relative;

  &.a {
    background: linear-gradient(white, white) padding-box,
    conic-gradient(
      from var(--border-angle),
      oklch(100% 100% 0deg),
      oklch(100% 100% 45deg),
      oklch(100% 100% 90deg),
      oklch(100% 100% 135deg),
      oklch(100% 100% 180deg),
      oklch(100% 100% 225deg),
      oklch(100% 100% 270deg),
      oklch(100% 100% 315deg),
      oklch(100% 100% 360deg)
    )
    border-box;
  }

  &.b {
    background: linear-gradient(white, white) padding-box,
    conic-gradient(
      from var(--border-angle),
      /*#0fdb80,*/
      orange,
      #ffffff,
      #ffffff,
      #ffffff,
      #ffffff,
      #ffffff,
      #ffffff,
      orange
    )
    border-box;
  }

  &.c {
    border-radius: 100%;
    background: radial-gradient(circle, var(--bg) 60%, transparent 60%);

    &:before,
    &:after {
      content: "";
      display: block;
      position: absolute;
      inset: 4px;
      border-radius: 100%;
      animation: border-angle-rotate 4s infinite linear;
      z-index: -1;
    }

    &:before {
      inset: 0;
      background: repeating-conic-gradient(
        from var(--border-angle),
        var(--bg),
        var(--bg) 30deg,
        oklch(100% 50% 190deg) calc(360deg / 6)
      )
      border-box;
    }

    &:after {
      background: repeating-conic-gradient(
        from calc(var(--border-angle) * -1),
        oklch(100% 40% 50deg),
        black 60deg
      )
      border-box;
    }
  }
}

@keyframes border-angle-rotate {
  from { --border-angle: 0deg; }
  to { --border-angle: 360deg; }
}

body {
  --bg: hsl(0, 0%, 100%);
}

@property --border-angle {
  syntax: "<angle>";
  initial-value: 0deg;
  inherits: false;
}

</style>
