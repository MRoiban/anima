// A separately bundled consumer must use the registered text module and its live caches.
import { measureText } from '../../core/index.ts';
import { fixedMeasurer } from '../core/measurer.ts';
declare global {
  interface Window {
    animaMeasureText: typeof measureText;
    animaTestMeasurer: typeof fixedMeasurer;
  }
}
window.animaMeasureText = measureText;
window.animaTestMeasurer = fixedMeasurer;
