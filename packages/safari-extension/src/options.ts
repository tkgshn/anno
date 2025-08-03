import { browser } from "./browser-polyfill";
$1

const { annoProjectName } = await browser.storage.sync.get(initialStorageValues);

const annoProjectNameInputElement = document.querySelector(
  "#anno-project-name-input"
);
if (!(annoProjectNameInputElement instanceof HTMLInputElement)) {
  throw new Error("Couldn't find the input element");
}
annoProjectNameInputElement.addEventListener("input", () =>
  browser.storage.sync.set({
    annoProjectName: annoProjectNameInputElement.value,
  })
);
annoProjectNameInputElement.value = annoProjectName;
