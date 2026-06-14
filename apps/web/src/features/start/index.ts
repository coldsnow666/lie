/**
 * @Description: 启动页 feature 的公开出口。
 *
 * @Date 2026-06-12 14:47
 */
export { default as BounceCards } from "./components/BounceCards";
export { default as RouteLoadingOverlay } from "./overlays/RouteLoadingOverlay";
export { default as StartScreen } from "./components/StartScreen";
export { useStartScreenTransition } from "./hooks/useStartScreenTransition";
export { cornerFlights, resolveViewportCornerFlights } from "./scene/cardScene";
