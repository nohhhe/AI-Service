/******/ (function(modules) { // webpackBootstrap
/******/ 	// The module cache
/******/ 	var installedModules = {};
/******/
/******/ 	// The require function
/******/ 	function __webpack_require__(moduleId) {
/******/
/******/ 		// Check if module is in cache
/******/ 		if(installedModules[moduleId]) {
/******/ 			return installedModules[moduleId].exports;
/******/ 		}
/******/ 		// Create a new module (and put it into the cache)
/******/ 		var module = installedModules[moduleId] = {
/******/ 			i: moduleId,
/******/ 			l: false,
/******/ 			exports: {}
/******/ 		};
/******/
/******/ 		// Execute the module function
/******/ 		modules[moduleId].call(module.exports, module, module.exports, __webpack_require__);
/******/
/******/ 		// Flag the module as loaded
/******/ 		module.l = true;
/******/
/******/ 		// Return the exports of the module
/******/ 		return module.exports;
/******/ 	}
/******/
/******/
/******/ 	// expose the modules object (__webpack_modules__)
/******/ 	__webpack_require__.m = modules;
/******/
/******/ 	// expose the module cache
/******/ 	__webpack_require__.c = installedModules;
/******/
/******/ 	// define getter function for harmony exports
/******/ 	__webpack_require__.d = function(exports, name, getter) {
/******/ 		if(!__webpack_require__.o(exports, name)) {
/******/ 			Object.defineProperty(exports, name, { enumerable: true, get: getter });
/******/ 		}
/******/ 	};
/******/
/******/ 	// define __esModule on exports
/******/ 	__webpack_require__.r = function(exports) {
/******/ 		if(typeof Symbol !== 'undefined' && Symbol.toStringTag) {
/******/ 			Object.defineProperty(exports, Symbol.toStringTag, { value: 'Module' });
/******/ 		}
/******/ 		Object.defineProperty(exports, '__esModule', { value: true });
/******/ 	};
/******/
/******/ 	// create a fake namespace object
/******/ 	// mode & 1: value is a module id, require it
/******/ 	// mode & 2: merge all properties of value into the ns
/******/ 	// mode & 4: return value when already ns object
/******/ 	// mode & 8|1: behave like require
/******/ 	__webpack_require__.t = function(value, mode) {
/******/ 		if(mode & 1) value = __webpack_require__(value);
/******/ 		if(mode & 8) return value;
/******/ 		if((mode & 4) && typeof value === 'object' && value && value.__esModule) return value;
/******/ 		var ns = Object.create(null);
/******/ 		__webpack_require__.r(ns);
/******/ 		Object.defineProperty(ns, 'default', { enumerable: true, value: value });
/******/ 		if(mode & 2 && typeof value != 'string') for(var key in value) __webpack_require__.d(ns, key, function(key) { return value[key]; }.bind(null, key));
/******/ 		return ns;
/******/ 	};
/******/
/******/ 	// getDefaultExport function for compatibility with non-harmony modules
/******/ 	__webpack_require__.n = function(module) {
/******/ 		var getter = module && module.__esModule ?
/******/ 			function getDefault() { return module['default']; } :
/******/ 			function getModuleExports() { return module; };
/******/ 		__webpack_require__.d(getter, 'a', getter);
/******/ 		return getter;
/******/ 	};
/******/
/******/ 	// Object.prototype.hasOwnProperty.call
/******/ 	__webpack_require__.o = function(object, property) { return Object.prototype.hasOwnProperty.call(object, property); };
/******/
/******/ 	// __webpack_public_path__
/******/ 	__webpack_require__.p = "dist/";
/******/
/******/
/******/ 	// Load entry module and return exports
/******/ 	return __webpack_require__(__webpack_require__.s = "./src/audio/worker.js");
/******/ })
/************************************************************************/
/******/ ({

/***/ "./src/audio/worker.js":
/*!*****************************!*\
  !*** ./src/audio/worker.js ***!
  \*****************************/
/*! no static exports found */
/***/ (function(module, exports, __webpack_require__) {

"use strict";
eval("/* globals Blob:false postMessage:false close:false */\n\n\nvar recLength = 0;\nvar recBuffer = [];\nvar recordSampleRate;\nself.onmessage = function (e) {\n  switch (e.data.command) {\n    case 'init':\n      init(e.data.config);\n      break;\n    case 'record':\n      record(e.data.buffer);\n      break;\n    case 'export':\n      exportBuffer(e.data.samplerate);\n      break;\n    case 'clear':\n      clear();\n      break;\n    case 'close':\n      close();\n      break;\n  }\n};\nfunction init(config) {\n  recordSampleRate = config.sampleRate;\n}\nfunction record(inputBuffer) {\n  recBuffer.push(inputBuffer[0]);\n  recLength += inputBuffer[0].length;\n}\nfunction exportBuffer(exportSampleRate) {\n  var mergedBuffers = mergeBuffers(recBuffer, recLength);\n  var downsampledBuffer = downsampleBuffer(mergedBuffers, exportSampleRate);\n  var encodedWav = encodeWAV(downsampledBuffer);\n  var audioBlob = new Blob([encodedWav], {\n    type: 'application/octet-stream'\n  });\n  postMessage(audioBlob);\n}\nfunction clear() {\n  recLength = 0;\n  recBuffer = [];\n}\nfunction downsampleBuffer(buffer, exportSampleRate) {\n  if (typeof exportSampleRate === 'undefined' || exportSampleRate === recordSampleRate) {\n    return buffer;\n  }\n  var sampleRateRatio = recordSampleRate / exportSampleRate;\n  var newLength = Math.round(buffer.length / sampleRateRatio);\n  var result = new Float32Array(newLength);\n  var offsetResult = 0;\n  var offsetBuffer = 0;\n  while (offsetResult < result.length) {\n    var nextOffsetBuffer = Math.round((offsetResult + 1) * sampleRateRatio);\n    var accum = 0;\n    var count = 0;\n    for (var i = offsetBuffer; i < nextOffsetBuffer && i < buffer.length; i++) {\n      accum += buffer[i];\n      count++;\n    }\n    result[offsetResult] = accum / count;\n    offsetResult++;\n    offsetBuffer = nextOffsetBuffer;\n  }\n  return result;\n}\nfunction mergeBuffers(bufferArray, recLength) {\n  var result = new Float32Array(recLength);\n  var offset = 0;\n  for (var i = 0; i < bufferArray.length; i++) {\n    result.set(bufferArray[i], offset);\n    offset += bufferArray[i].length;\n  }\n  return result;\n}\nfunction floatTo16BitPCM(output, offset, input) {\n  for (var i = 0; i < input.length; i++, offset += 2) {\n    var s = Math.max(-1, Math.min(1, input[i]));\n    output.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7FFF, true);\n  }\n}\nfunction writeString(view, offset, string) {\n  for (var i = 0; i < string.length; i++) {\n    view.setUint8(offset + i, string.charCodeAt(i));\n  }\n}\nfunction encodeWAV(samples) {\n  var buffer = new ArrayBuffer(44 + samples.length * 2);\n  var view = new DataView(buffer);\n  writeString(view, 0, 'RIFF');\n  view.setUint32(4, 32 + samples.length * 2, true);\n  writeString(view, 8, 'WAVE');\n  writeString(view, 12, 'fmt ');\n  view.setUint32(16, 16, true);\n  view.setUint16(20, 1, true);\n  view.setUint16(22, 1, true);\n  view.setUint32(24, recordSampleRate, true);\n  view.setUint32(28, recordSampleRate * 2, true);\n  view.setUint16(32, 2, true);\n  view.setUint16(34, 16, true);\n  writeString(view, 36, 'data');\n  view.setUint32(40, samples.length * 2, true);\n  floatTo16BitPCM(view, 44, samples);\n  return view;\n}//# sourceURL=[module]\n//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIndlYnBhY2s6Ly8vLi9zcmMvYXVkaW8vd29ya2VyLmpzP2E5OGQiXSwibmFtZXMiOlsicmVjTGVuZ3RoIiwicmVjQnVmZmVyIiwicmVjb3JkU2FtcGxlUmF0ZSIsInNlbGYiLCJvbm1lc3NhZ2UiLCJlIiwiZGF0YSIsImNvbW1hbmQiLCJpbml0IiwiY29uZmlnIiwicmVjb3JkIiwiYnVmZmVyIiwiZXhwb3J0QnVmZmVyIiwic2FtcGxlcmF0ZSIsImNsZWFyIiwiY2xvc2UiLCJzYW1wbGVSYXRlIiwiaW5wdXRCdWZmZXIiLCJwdXNoIiwibGVuZ3RoIiwiZXhwb3J0U2FtcGxlUmF0ZSIsIm1lcmdlZEJ1ZmZlcnMiLCJtZXJnZUJ1ZmZlcnMiLCJkb3duc2FtcGxlZEJ1ZmZlciIsImRvd25zYW1wbGVCdWZmZXIiLCJlbmNvZGVkV2F2IiwiZW5jb2RlV0FWIiwiYXVkaW9CbG9iIiwiQmxvYiIsInR5cGUiLCJwb3N0TWVzc2FnZSIsInNhbXBsZVJhdGVSYXRpbyIsIm5ld0xlbmd0aCIsIk1hdGgiLCJyb3VuZCIsInJlc3VsdCIsIkZsb2F0MzJBcnJheSIsIm9mZnNldFJlc3VsdCIsIm9mZnNldEJ1ZmZlciIsIm5leHRPZmZzZXRCdWZmZXIiLCJhY2N1bSIsImNvdW50IiwiaSIsImJ1ZmZlckFycmF5Iiwib2Zmc2V0Iiwic2V0IiwiZmxvYXRUbzE2Qml0UENNIiwib3V0cHV0IiwiaW5wdXQiLCJzIiwibWF4IiwibWluIiwic2V0SW50MTYiLCJ3cml0ZVN0cmluZyIsInZpZXciLCJzdHJpbmciLCJzZXRVaW50OCIsImNoYXJDb2RlQXQiLCJzYW1wbGVzIiwiQXJyYXlCdWZmZXIiLCJEYXRhVmlldyIsInNldFVpbnQzMiIsInNldFVpbnQxNiJdLCJtYXBwaW5ncyI6IkFBQUE7QUFDWTs7QUFFWixJQUFJQSxTQUFTLEdBQUcsQ0FBQztBQUNqQixJQUFJQyxTQUFTLEdBQUcsRUFBRTtBQUNsQixJQUFJQyxnQkFBZ0I7QUFHcEJDLElBQUksQ0FBQ0MsU0FBUyxHQUFHLFVB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LENBQUM7RUFDM0JSLElBQUksQ0FBQ1EsU0FBUyxDQUFDLEVBQUUsRUFBRSxFQUFFLEVBQUUsSUFBSSxDQUFDO0VBQzVCVCxXQUFXLENBQUNDLElBQUksRUFBRSxFQUFFLEVBQUUsTUFBTSxDQUFDO0VBQzdCQSxJQUFJLENBQUNPLFNBQVMsQ0FBQyxFQUFFLEVBQUVILE9BQU8sQ0FBQ3ZDLE1BQU0sR0FBRyxDQUFDLEVBQUUsSUFBSSxDQUFDO0VBQzVDMkIsZUFBZSxDQUFDUSxJQUFJLEVBQUUsRUFBRSxFQUFFSSxPQUFPLENBQUM7RUFFbEMsT0FBT0osSUFBSTtBQUNiIiwiZmlsZSI6Ii4vc3JjL2F1ZGlvL3dvcmtlci5qcy5qcyIsInNvdXJjZXNDb250ZW50IjpbIi8qIGdsb2JhbHMgQmxvYjpmYWxzZSBwb3N0TWVzc2FnZTpmYWxzZSBjbG9zZTpmYWxzZSAqL1xuJ3VzZSBzdHJpY3QnXG5cbmxldCByZWNMZW5ndGggPSAwXG5sZXQgcmVjQnVmZmVyID0gW11cbmxldCByZWNvcmRTYW1wbGVSYXRlXG5cblxuc2VsZi5vbm1lc3NhZ2UgPSBmdW5jdGlvbiAoZSkge1xuICBzd2l0Y2ggKGUuZGF0YS5jb21tYW5kKSB7XG4gICAgY2FzZSAnaW5pdCc6XG4gICAgICBpbml0KGUuZGF0YS5jb25maWcpXG4gICAgICBicmVha1xuICAgIGNhc2UgJ3JlY29yZCc6XG4gICAgICByZWNvcmQoZS5kYXRhLmJ1ZmZlcilcbiAgICAgIGJyZWFrXG4gICAgY2FzZSAnZXhwb3J0JzpcbiAgICAgIGV4cG9ydEJ1ZmZlcihlLmRhdGEuc2FtcGxlcmF0ZSlcbiAgICAgIGJyZWFrXG4gICAgY2FzZSAnY2xlYXInOlxuICAgICAgY2xlYXIoKVxuICAgICAgYnJlYWtcbiAgICBjYXNlICdjbG9zZSc6XG4gICAgICBjbG9zZSgpXG4gICAgICBicmVha1xuICB9XG59XG5cblxuZnVuY3Rpb24gaW5pdCAoY29uZmlnKSB7XG4gIHJlY29yZFNhbXBsZVJhdGUgPSBjb25maWcuc2FtcGxlUmF0ZVxufVxuXG5cbmZ1bmN0aW9uIHJlY29yZCAoaW5wdXRCdWZmZXIpIHtcbiAgcmVjQnVmZmVyLnB1c2goaW5wdXRCdWZmZXJbMF0pXG4gIHJlY0xlbmd0aCArPSBpbnB1dEJ1ZmZlclswXS5sZW5ndGhcbn1cblxuXG5mdW5jdGlvbiBleHBvcnRCdWZmZXIgKGV4cG9ydFNhbXBsZVJhdGUpIHtcbiAgbGV0IG1lcmdlZEJ1ZmZlcnMgPSBtZXJnZUJ1ZmZlcnMocmVjQnVmZmVyLCByZWNMZW5ndGgpXG4gIGxldCBkb3duc2FtcGxlZEJ1ZmZlciA9IGRvd25zYW1wbGVCdWZmZXIobWVyZ2VkQnVmZmVycywgZXhwb3J0U2FtcGxlUmF0ZSlcbiAgbGV0IGVuY29kZWRXYXYgPSBlbmNvZGVXQVYoZG93bnNhbXBsZWRCdWZmZXIpXG4gIGxldCBhdWRpb0Jsb2IgPSBuZXcgQmxvYihbZW5jb2RlZFdhdl0sIHt0eXBlOiAnYXBwbGljYXRpb24vb2N0ZXQtc3RyZWFtJ30pXG4gIHBvc3RNZXNzYWdlKGF1ZGlvQmxvYilcbn1cblxuXG5mdW5jdGlvbiBjbGVhciAoKSB7XG4gIHJlY0xlbmd0aCA9IDBcbiAgcmVjQnVmZmVyID0gW11cbn1cblxuXG5mdW5jdGlvbiBkb3duc2FtcGxlQnVmZmVyIChidWZmZXIsIGV4cG9ydFNhbXBsZVJhdGUpIHtcbiAgaWYgKHR5cGVvZiBleHBvcnRTYW1wbGVSYXRlID09PSAndW5kZWZpbmVkJyB8fCBleHBvcnRTYW1wbGVSYXRlID09PSByZWNvcmRTYW1wbGVSYXRlKSB7XG4gICAgcmV0dXJuIGJ1ZmZlclxuICB9XG4gIGxldCBzYW1wbGVSYXRlUmF0aW8gPSByZWNvcmRTYW1wbGVSYXRlIC8gZXhwb3J0U2FtcGxlUmF0ZVxuICBsZXQgbmV3TGVuZ3RoID0gTWF0aC5yb3VuZChidWZmZXIubGVuZ3RoIC8gc2FtcGxlUmF0ZVJhdGlvKVxuICBsZXQgcmVzdWx0ID0gbmV3IEZsb2F0MzJBcnJheShuZXdMZW5ndGgpXG4gIGxldCBvZmZzZXRSZXN1bHQgPSAwXG4gIGxldCBvZmZzZXRCdWZmZXIgPSAwXG4gIHdoaWxlIChvZmZzZXRSZXN1bHQgPCByZXN1bHQubGVuZ3RoKSB7XG4gICAgbGV0IG5leHRPZmZzZXRCdWZmZXIgPSBNYXRoLnJvdW5kKChvZmZzZXRSZXN1bHQgKyAxKSAqIHNhbXBsZVJhdGVSYXRpbylcbiAgICBsZXQgYWNjdW0gPSAwXG4gICAgbGV0IGNvdW50ID0gMFxuICAgIGZvciAobGV0IGkgPSBvZmZzZXRCdWZmZXI7IGkgPCBuZXh0T2Zmc2V0QnVmZmVyICYmIGkgPCBidWZmZXIubGVuZ3RoOyBpKyspIHtcbiAgICAgIGFjY3VtICs9IGJ1ZmZlcltpXVxuICAgICAgY291bnQrK1xuICAgIH1cbiAgICByZXN1bHRbb2Zmc2V0UmVzdWx0XSA9IGFjY3VtIC8gY291bnRcbiAgICBvZmZzZXRSZXN1bHQrK1xuICAgIG9mZnNldEJ1ZmZlciA9IG5leHRPZmZzZXRCdWZmZXJcbiAgfVxuICByZXR1cm4gcmVzdWx0XG59XG5cblxuZnVuY3Rpb24gbWVyZ2VCdWZmZXJzIChidWZmZXJBcnJheSwgcmVjTGVuZ3RoKSB7XG4gIGxldCByZXN1bHQgPSBuZXcgRmxvYXQzMkFycmF5KHJlY0xlbmd0aClcbiAgbGV0IG9mZnNldCA9IDBcbiAgZm9yIChsZXQgaSA9IDA7IGkgPCBidWZmZXJBcnJheS5sZW5ndGg7IGkrKykge1xuICAgIHJlc3VsdC5zZXQoYnVmZmVyQXJyYXlbaV0sIG9mZnNldClcbiAgICBvZmZzZXQgKz0gYnVmZmVyQXJyYXlbaV0ubGVuZ3RoXG4gIH1cbiAgcmV0dXJuIHJlc3VsdFxufVxuXG5cbmZ1bmN0aW9uIGZsb2F0VG8xNkJpdFBDTSAob3V0cHV0LCBvZmZzZXQsIGlucHV0KSB7XG4gIGZvciAobGV0IGkgPSAwOyBpIDwgaW5wdXQubGVuZ3RoOyBpKyssIG9mZnNldCArPSAyKSB7XG4gICAgbGV0IHMgPSBNYXRoLm1heCgtMSwgTWF0aC5taW4oMSwgaW5wdXRbaV0pKVxuICAgIG91dHB1dC5zZXRJbnQxNihvZmZzZXQsIHMgPCAwID8gcyAqIDB4ODAwMCA6IHMgKiAweDdGRkYsIHRydWUpXG4gIH1cbn1cblxuXG5mdW5jdGlvbiB3cml0ZVN0cmluZyAodmlldywgb2Zmc2V0LCBzdHJpbmcpIHtcbiAgZm9yIChsZXQgaSA9IDA7IGkgPCBzdHJpbmcubGVuZ3RoOyBpKyspIHtcbiAgICB2aWV3LnNldFVpbnQ4KG9mZnNldCArIGksIHN0cmluZy5jaGFyQ29kZUF0KGkpKVxuICB9XG59XG5cblxuZnVuY3Rpb24gZW5jb2RlV0FWIChzYW1wbGVzKSB7XG4gIGxldCBidWZmZXIgPSBuZXcgQXJyYXlCdWZmZXIoNDQgKyBzYW1wbGVzLmxlbmd0aCAqIDIpXG4gIGxldCB2aWV3ID0gbmV3IERhdGFWaWV3KGJ1ZmZlcilcblxuICB3cml0ZVN0cmluZyh2aWV3LCAwLCAnUklGRicpXG4gIHZpZXcuc2V0VWludDMyKDQsIDMyICsgc2FtcGxlcy5sZW5ndGggKiAyLCB0cnVlKVxuICB3cml0ZVN0cmluZyh2aWV3LCA4LCAnV0FWRScpXG4gIHdyaXRlU3RyaW5nKHZpZXcsIDEyLCAnZm10ICcpXG4gIHZpZXcuc2V0VWludDMyKDE2LCAxNiwgdHJ1ZSlcbiAgdmlldy5zZXRVaW50MTYoMjAsIDEsIHRydWUpXG4gIHZpZXcuc2V0VWludDE2KDIyLCAxLCB0cnVlKVxuICB2aWV3LnNldFVpbnQzMigyNCwgcmVjb3JkU2FtcGxlUmF0ZSwgdHJ1ZSlcbiAgdmlldy5zZXRVaW50MzIoMjgsIHJlY29yZFNhbXBsZVJhdGUgKiAyLCB0cnVlKVxuICB2aWV3LnNldFVpbnQxNigzMiwgMiwgdHJ1ZSlcbiAgdmlldy5zZXRVaW50MTYoMzQsIDE2LCB0cnVlKVxuICB3cml0ZVN0cmluZyh2aWV3LCAzNiwgJ2RhdGEnKVxuICB2aWV3LnNldFVpbnQzMig0MCwgc2FtcGxlcy5sZW5ndGggKiAyLCB0cnVlKVxuICBmbG9hdFRvMTZCaXRQQ00odmlldywgNDQsIHNhbXBsZXMpXG5cbiAgcmV0dXJuIHZpZXdcbn1cblxuIl0sInNvdXJjZVJvb3QiOiIifQ==\n//# sourceURL=webpack-internal:///./src/audio/worker.js\n");

/***/ })

/******/ });