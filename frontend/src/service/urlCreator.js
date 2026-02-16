import {ref} from "vue";

export function useUrlCreator(url, params) {
  const endpoint = ref('')

  const getEndpoint = () => {
    const searchParams = new URLSearchParams(params).toString()
    endpoint.value = `${url}?${searchParams}`
  }

  getEndpoint()

  return { endpoint }
}
