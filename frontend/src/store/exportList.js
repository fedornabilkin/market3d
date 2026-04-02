import {ref} from "vue";

const collection = ref([])
const downloadAll = ref(0)
const keyStore = 'exportList'
const keyStoreAll = 'exportAll'
let syncCallback = (items) => {return items}

export function useExportList () {

  const getCollection = () => {
    return collection.value
  }

  const setDownloadAll = (value) => {
    return downloadAll.value = value
  }

  const getDownloadAll = () => {
    return downloadAll.value
  }

  const downloadAllUpdate = () => {
    downloadAll.value++
  }

  const getLimit = () => {
    return 5
  }

  const fillCollection = (items) => {
    return collection.value = items
  }

  const setCallback = (cb) => {
    syncCallback = cb
  }

  const add = (item, max = getLimit()) => {
    collection.value.unshift(item)
    if(collection.value.length > max) {
      collection.value.pop()
    }
    syncCallback(collection.value)
  }

  const removeItem = (item) => {
    collection.value.splice(collection.value.indexOf(item), 1)
    syncCallback(collection.value)
  }

  return {
    getCollection,
    fillCollection,
    add,
    keyStore,
    keyStoreAll,
    getLimit,
    removeItem,
    setCallback,
    setDownloadAll,
    getDownloadAll,
    downloadAllUpdate
  }
}
