import {
  defineComponent,
  ref,
  onMounted,
  onUnmounted,
  watch,
  h,
  type PropType,
  type CSSProperties,
} from "vue";
import { HWPXViewer } from "../lib/HWPXViewer";
import type { JHwpxViewerVueExpose } from "./types";
import type { DocumentMeta } from "../lib/types";

export const JHwpxViewer = defineComponent({
  name: "JHwpxViewer",
  props: {
    file: {
      type: [Object, String] as PropType<File | ArrayBuffer | Uint8Array | string>,
      default: undefined,
    },
    fileName: {
      type: String,
      default: undefined,
    },
    className: {
      type: String,
      default: "",
    },
    style: {
      type: Object as PropType<CSSProperties>,
      default: () => ({}),
    },
    initialZoom: {
      type: [Number, String] as PropType<number | "fit-width" | "fit-page">,
      default: "fit-width",
    },
    pageGap: {
      type: Number,
      default: 24,
    },
    animatedZoom: {
      type: Boolean,
      default: true,
    },
  },
  emits: ["documentLoaded", "pageChange", "zoomChange", "error"],
  setup(props, { emit, expose }) {
    const containerRef = ref<HTMLDivElement | null>(null);
    let viewerInstance: HWPXViewer | null = null;

    const loadSource = async (source: File | ArrayBuffer | Uint8Array | string, name?: string) => {
      if (!viewerInstance) return;

      if (typeof source === "string") {
        try {
          const res = await fetch(source);
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          const buf = await res.arrayBuffer();
          const resolvedName = name || source.split("/").pop() || "document.hwpx";
          await viewerInstance.load(buf, resolvedName);
        } catch (err: any) {
          emit("error", err instanceof Error ? err : new Error(String(err)));
        }
      } else {
        await viewerInstance.load(source, name);
      }
    };

    onMounted(() => {
      if (!containerRef.value) return;

      viewerInstance = new HWPXViewer(containerRef.value, {
        initialZoom: props.initialZoom,
        pageGap: props.pageGap,
        animatedZoom: props.animatedZoom,
        onDocumentLoaded: (meta: DocumentMeta) => emit("documentLoaded", meta),
        onPageChange: (page: number, total: number) => emit("pageChange", page, total),
        onZoomChange: (zoom: number) => emit("zoomChange", zoom),
        onError: (err: Error) => emit("error", err),
      });

      if (props.file) {
        loadSource(props.file, props.fileName);
      }
    });

    watch(
      () => props.file,
      (newFile) => {
        if (newFile && viewerInstance) {
          loadSource(newFile, props.fileName);
        }
      }
    );

    onUnmounted(() => {
      viewerInstance?.destroy();
      viewerInstance = null;
    });

    const exposes: JHwpxViewerVueExpose = {
      get viewer() {
        return viewerInstance;
      },
      load: (source, name) => loadSource(source, name),
      zoomIn: () => viewerInstance?.zoomIn(),
      zoomOut: () => viewerInstance?.zoomOut(),
      resetZoom: () => viewerInstance?.resetZoom(),
      fitWidth: () => viewerInstance?.fitWidth(),
      nextPage: () => viewerInstance?.nextPage(),
      prevPage: () => viewerInstance?.prevPage(),
      goToPage: (page: number) => viewerInstance?.goToPage(page),
      print: () => viewerInstance?.print(),
    };

    expose(exposes);

    return () =>
      h("div", {
        ref: containerRef,
        class: `jhwpx-vue-container ${props.className || ""}`,
        style: {
          width: "100%",
          height: "100%",
          position: "relative",
          overflow: "hidden",
          ...props.style,
        },
      });
  },
});

export default JHwpxViewer;
