import { browser } from "./browser-polyfill";
import type { ContentToBackgroundMessage } from "./types/messages";

export interface IframeData {
  url: string;
  description: string;
  iconURL: string;
  iconWidth: number;
  iconHeight: number;
}

document.body.style.margin = "0px";

const searchParams = new URLSearchParams(location.search);
const id = searchParams.get("id");
if (!id) {
  throw new Error("id is empty. ");
}

const { [id]: iframeData } = await browser.storage.local.get(id);
const { url, description, iconURL, iconWidth, iconHeight }: IframeData =
  iframeData;

const linkElement = document.createElement("a");
linkElement.href = url;
linkElement.rel = "noopener";
linkElement.target = "_blank";
linkElement.title = description;
linkElement.addEventListener("click", (event) => {
  event.preventDefault();

  const openMessage: ContentToBackgroundMessage = { type: "URL_CHANGED", url };
  browser.runtime.sendMessage(openMessage);
});

const imageElement = document.createElement("img");
imageElement.src = iconURL;
imageElement.style.verticalAlign = "middle";
imageElement.style.width = `${iconWidth}px`;
imageElement.style.height = `${iconHeight}px`;
linkElement.append(imageElement);

document.body.append(linkElement);
