const { createApp } = Vue;

const IMAGE_EXTENSIONS = [".jpg", ".jpeg", ".png", ".gif", ".webp"];
const AUDIO_EXTENSIONS = [".ogg"];

const app = createApp({
  data() {
    return {
      zipName: "",
      loading: false,
      errorMessage: "",
      ready: false,
      activeTab: "messages",
      chats: [],
      albums: [],
      selectedMessages: [],
      selectedAlbums: [],
      downloadLog: [],
      downloading: false,
      zip: null,
      cache: new Map(),
    };
  },
  computed: {
    allMessagesSelected() {
      return this.chats.length > 0 && this.selectedMessages.length === this.chats.length;
    },
    allAlbumsSelected() {
      return this.albums.length > 0 && this.selectedAlbums.length === this.albums.length;
    },
  },
  methods: {
    async handleZipUpload(event) {
      const file = event.target.files[0];
      if (!file) return;

      this.loading = true;
      this.errorMessage = "";
      this.ready = false;
      this.zipName = file.name;
      this.downloadLog = [];
      this.selectedMessages = [];
      this.selectedAlbums = [];
      this.cache.clear();

      try {
        this.zip = await JSZip.loadAsync(file);
        await this.loadMessages();
        await this.loadAlbums();
        this.ready = true;
      } catch (error) {
        console.error(error);
        this.errorMessage =
          "Could not read the archive. Please make sure it is a valid VK HTML export ZIP.";
      } finally {
        this.loading = false;
      }
    },
    toggleAll(type) {
      if (type === "messages") {
        this.selectedMessages = this.allMessagesSelected
          ? []
          : this.chats.map((chat) => chat.path);
      } else {
        this.selectedAlbums = this.allAlbumsSelected
          ? []
          : this.albums.map((album) => album.path);
      }
    },
    async loadMessages() {
      const indexPath = this.findFilePath(/messages\/index-messages\.html$/i);
      if (!indexPath) {
        this.chats = [];
        return;
      }

      const html = await this.readHtml(indexPath);
      const doc = new DOMParser().parseFromString(html, "text/html");
      const links = Array.from(doc.querySelectorAll(".message-peer--id a"));
      this.chats = links.map((link) => ({
        title: link.textContent.trim() || link.getAttribute("href"),
        path: `messages/${link.getAttribute("href")}`,
      }));
    },
    async loadAlbums() {
      const indexPath = this.findFilePath(/photos\/photo-albums\.html$/i);
      if (!indexPath) {
        this.albums = [];
        return;
      }

      const html = await this.readHtml(indexPath);
      const doc = new DOMParser().parseFromString(html, "text/html");
      const links = Array.from(doc.querySelectorAll(".item__main a"))
        .map((link) => ({
          title: link.textContent.trim() || link.getAttribute("href"),
          href: link.getAttribute("href"),
        }))
        .filter((link) => link.href && link.href.includes("photo-albums/"));

      this.albums = links.map((link) => ({
        title: link.title,
        path: `photos/${link.href}`,
      }));
    },
    async downloadSelected(type) {
      this.downloading = true;
      const selection = type === "messages" ? this.selectedMessages : this.selectedAlbums;
      const label = type === "messages" ? "Chats" : "Albums";
      this.pushLog(`${label} download`, `Preparing ${selection.length} items...`);

      try {
        const zip = new JSZip();
        for (const path of selection) {
          const name = path.split("/").pop().replace(/\.html$/, "");
          const folder = zip.folder(name || "media");
          const urls = await this.getMediaUrls(path, type);

          this.pushLog(name, `Found ${urls.length} media links.`);
          let index = 1;
          for (const url of urls) {
            try {
              const response = await fetch(url);
              if (!response.ok) throw new Error("Network error");
              const blob = await response.blob();
              const filename = this.buildFilename(url, index);
              folder.file(filename, blob);
              index += 1;
            } catch (error) {
              console.warn(`Failed to fetch ${url}`, error);
            }
          }
        }

        const blob = await zip.generateAsync({ type: "blob" });
        saveAs(blob, `vk-${type}-media.zip`);
        this.pushLog(`${label} download`, "Your ZIP is ready.");
      } catch (error) {
        console.error(error);
        this.pushLog(`${label} download`, "Download failed. Try again.");
      } finally {
        this.downloading = false;
      }
    },
    async getMediaUrls(path, type) {
      if (this.cache.has(path)) {
        return this.cache.get(path);
      }

      const html = await this.readHtml(path);
      const doc = new DOMParser().parseFromString(html, "text/html");
      let urls = [];

      if (type === "messages") {
        const links = Array.from(doc.querySelectorAll("a.attachment__link"));
        urls = links
          .map((link) => link.getAttribute("href"))
          .filter((href) => href && this.isSupportedMedia(href));
      } else {
        const images = Array.from(doc.querySelectorAll("img"));
        urls = images
          .map((image) => image.getAttribute("src"))
          .filter((src) => src && this.isImage(src));
      }

      const unique = Array.from(new Set(urls));
      this.cache.set(path, unique);
      return unique;
    },
    isSupportedMedia(url) {
      return this.isImage(url) || this.isAudio(url);
    },
    isImage(url) {
      return IMAGE_EXTENSIONS.some((ext) => url.toLowerCase().includes(ext));
    },
    isAudio(url) {
      return AUDIO_EXTENSIONS.some((ext) => url.toLowerCase().includes(ext));
    },
    buildFilename(url, index) {
      try {
        const parsed = new URL(url);
        const name = parsed.pathname.split("/").pop();
        if (name) return name;
      } catch (error) {
        // ignore
      }
      return `media-${index}`;
    },
    async readHtml(path) {
      const file = this.zip.file(path);
      if (!file) {
        throw new Error(`Missing file: ${path}`);
      }
      const buffer = await file.async("arraybuffer");
      const decoder = this.getDecoder();
      return decoder.decode(buffer);
    },
    getDecoder() {
      try {
        return new TextDecoder("windows-1251");
      } catch (error) {
        return new TextDecoder("utf-8");
      }
    },
    findFilePath(pattern) {
      const match = Object.keys(this.zip.files).find((key) => pattern.test(key));
      return match || "";
    },
    pushLog(label, message) {
      this.downloadLog.unshift({
        id: `${label}-${Date.now()}-${Math.random()}`,
        label,
        message,
      });
    },
  },
});

app.mount("#app");
