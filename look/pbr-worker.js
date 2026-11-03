/* Web Worker: builds the REALISTIC look's PBR atlas off the main thread */
import {buildPBR} from './pbr.js';
onmessage=e=>{try{const {data,w,h}=e.data;const o=buildPBR(data,w,h);postMessage(o,[o.alb.buffer,o.nrm.buffer,o.orm.buffer]);}catch(err){postMessage({error:String(err&&err.message||err)});}};
