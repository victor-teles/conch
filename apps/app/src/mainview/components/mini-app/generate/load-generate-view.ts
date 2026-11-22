export const loadGenerateView = () => import("./mini-app-generate-view");

// Typing a description shows "Build an app"; fetching the view then means ↵
// opens it on the first frame instead of after the chunk arrives.
export const preloadGenerateView = async (): Promise<void> => {
  try {
    await loadGenerateView();
  } catch (error) {
    console.error("[apps] could not preload the app builder", error);
  }
};
