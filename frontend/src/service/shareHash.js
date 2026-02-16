import {ref} from "vue";

export function useShareHash () {

  const marker = ref('#share')
  const separator = ref('-')

  const encode = (data) => {
    return btoa(data)
  }

  const decode = (data) => {
    return atob(data)
  }

  const encodeUri = (data) => {
    return encodeURIComponent(data)
  }

  const decodeUri = (data) => {
    return decodeURIComponent(data)
  }

  const create = (data) => {
    const encodeStr = encode(encodeURI(JSON.stringify(data, null, 0)))
    return `${marker.value}${separator.value}${encodeStr}`
  }

  const parse = (hash) => {
    const raw = hash.split(separator.value)
    const decodeStr = JSON.parse(decodeUri(decode(raw[1])))
    return Object.assign(decodeStr, {})
  }

  const shareIsValid = (hash) => {
    return hash.startsWith(marker.value)
  }

  return {
    shareIsValid,
    create,
    parse,
  }
}
