import Worker from './worker?worker'

const worker = new Worker('./worker.js', { type: 'module' });
// const worker = new Worker
// console.log(worker)
const send = (message) => {
  // const params =  {mode: message.mode, options: {base: message.options.base, code: message.options.code}}
  // console.log('message ', params)
  const params = JSON.parse(JSON.stringify(message))
  return worker.postMessage(params)
  // return worker.postMessage(message)
}
// const send = (message) => {
//   console.log(worker)
//   console.log(message)
//   worker.postMessage(message);
// }

export default {
  worker,
  send,
};
