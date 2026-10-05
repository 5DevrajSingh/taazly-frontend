import { useEffect, useRef, useState } from "react";
import { getProduct, uploadProductImages, reorderProductImages, deleteProductImage } from "../../services/productService";
function ImagePreview({
  path,
  alt,
  className
}) {
  const [failedPath, setFailedPath] = useState(null);
  if (!path || failedPath === path) {
    return <div className={`${className} flex items-center justify-center text-xs text-slate-400`}>{path ? "Preview unavailable" : "No image"}</div>;
  }
  const backend = import.meta.env.VITE_API_BASE_URL || "http://localhost:5000";
  const src = new URL(path, new URL(backend, window.location.origin)).href;
  return <img src={src} alt={alt} draggable={false} className={className} onError={() => setFailedPath(path)} />;
}
function moveItem(items, from, to) {
  const next = [...items];
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item);
  return next;
}
export default function ProductImageGallery({
  product,
  files,
  onFilesChange,
  disabled,
  mutationLock,
  onBusyChange,
  onGalleryChange
}) {
  const [images, setImages] = useState([]);
  const [previews, setPreviews] = useState([]);
  const [loading, setLoading] = useState(false);
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [refresh, setRefresh] = useState(0);
  const [drag, setDrag] = useState(null);
  const [draft, setDraft] = useState(null);
  const gestureRef = useRef(null);
  const draftRef = useRef(null);
  const blocked = Boolean(disabled || busy || loading);
  useEffect(() => {
    const next = files.map(file => ({
      file,
      url: URL.createObjectURL(file)
    }));
    setPreviews(next);
    return () => next.forEach(preview => URL.revokeObjectURL(preview.url));
  }, [files]);
  useEffect(() => {
    setImages([]);
    setReady(false);
    setError("");
    setMessage("");
    if (!product) {
      setLoading(false);
      return;
    }
    const controller = new AbortController();
    let active = true;
    setLoading(true);
    async function load() {
      try {
        const result = await getProduct(product.store_id, product.id, {
          signal: controller.signal
        });
        const data = result?.data;
        if (!result?.success || String(data?.id) !== String(product.id) || String(data?.store_id) !== String(product.store_id) || !Array.isArray(data?.images)) {
          throw new Error(result?.message || "Invalid product gallery response.");
        }
        if (active) {
          setImages(data.images);
          setReady(true);
        }
      } catch (err) {
        if (active && !controller.signal.aborted) setError(getError(err));
      } finally {
        if (active) setLoading(false);
      }
    }
    load();
    return () => {
      active = false;
      controller.abort();
    };
  }, [product?.id, product?.store_id, refresh]);
  useEffect(() => () => {
    if (gestureRef.current) clearTimeout(gestureRef.current.timer);
  }, []);
  function getError(err) {
    return err?.response?.data?.message || err?.message || "Unable to update images.";
  }
  function applyResult(result) {
    if (!result?.success || !Array.isArray(result.data)) {
      throw new Error(result?.message || "Invalid product gallery response.");
    }
    setImages(result.data);
    onGalleryChange(result.data);
    return result.data;
  }
  async function saveGallery(action, value) {
    if (!product || !ready || blocked || mutationLock.current) return;
    if (action === "upload" && !files.length) return;
    mutationLock.current = true;
    setBusy(true);
    onBusyChange(true);
    setError("");
    setMessage("");
    try {
      let result;
      if (action === "upload") {
        result = await uploadProductImages(product.store_id, product.id, files);
      } else if (action === "delete") {
        result = await deleteProductImage(product.store_id, product.id, value);
      } else {
        result = await reorderProductImages(product.store_id, product.id, value.map(image => Number(image.id)));
      }
      applyResult(result);
      if (action === "upload") onFilesChange([]);
      setMessage(result.message || "Images updated successfully.");
    } catch (err) {
      setError(getError(err));
    } finally {
      mutationLock.current = false;
      setBusy(false);
      onBusyChange(false);
    }
  }
  function selectFiles(event) {
    const selected = Array.from(event.target.files || []);
    event.target.value = "";
    if (!selected.length || blocked || mutationLock.current) return;
    setError("");
    setMessage("");
    if (selected.length + files.length > 10) {
      setError("Select up to 10 new images per upload.");
      return;
    }
    if (selected.some(file => !file.type.startsWith("image/"))) {
      setError("Please select only image files.");
      return;
    }
    if (selected.some(file => file.size > 5 * 1024 * 1024)) {
      setError("Each image must be 5 MB or less.");
      return;
    }
    onFilesChange([...files, ...selected]);
  }
  function promote(kind, key) {
    if (blocked || mutationLock.current) return;
    if (kind === "saved") {
      const index = images.findIndex(image => String(image.id) === String(key));
      if (index > 0) saveGallery("order", moveItem(images, index, 0));
    } else {
      const index = previews.findIndex(preview => preview.url === key);
      if (index > 0) onFilesChange(moveItem(files, index, 0));
    }
  }
  function startGesture(event, kind, key) {
    if (blocked || mutationLock.current || gestureRef.current || !event.isPrimary || event.button !== 0) return;
    const node = event.currentTarget;
    node.setPointerCapture(event.pointerId);
    const items = kind === "saved" ? images : previews;
    const gesture = {
      kind,
      key,
      node,
      pointerId: event.pointerId,
      x: event.clientX,
      y: event.clientY,
      items: [...items],
      strip: node.parentElement.parentElement,
      scrollLeft: node.parentElement.parentElement.scrollLeft || 0,
      active: false,
      cancelled: false,
      moved: false,
      timer: null
    };
    gestureRef.current = gesture;
    gesture.timer = setTimeout(() => {
      if (gestureRef.current !== gesture || gesture.cancelled) return;
      gesture.active = true;
      draftRef.current = {
        kind,
        items: [...items]
      };
      setDraft(draftRef.current);
      setDrag({
        kind,
        key
      });
    }, 350);
  }
  function moveGesture(event) {
    const gesture = gestureRef.current;
    if (!gesture || event.pointerId !== gesture.pointerId) return;
    if (!gesture.active) {
      if (Math.hypot(event.clientX - gesture.x, event.clientY - gesture.y) > 8) {
        clearTimeout(gesture.timer);
        gesture.cancelled = true;
      }
      if (gesture.cancelled && event.pointerType === "touch") {
        const dx = event.clientX - gesture.x;
        const dy = event.clientY - gesture.y;
        if (Math.abs(dx) > Math.abs(dy)) {
          gesture.strip.scrollLeft = gesture.scrollLeft - dx;
        }
      }
      return;
    }
    event.preventDefault();
    const target = document.elementFromPoint(event.clientX, event.clientY)?.closest("[data-product-thumbnail]");
    if (!target || !gesture.node.parentElement.parentElement.contains(target) || target.dataset.kind !== gesture.kind) return;
    const targetKey = target.dataset.imageKey;
    const current = draftRef.current.items;
    const getKey = item => gesture.kind === "saved" ? String(item.id) : item.url;
    const from = current.findIndex(item => getKey(item) === String(gesture.key));
    const to = current.findIndex(item => getKey(item) === targetKey);
    if (from < 0 || to < 0 || from === to) return;
    gesture.moved = true;
    draftRef.current = {
      kind: gesture.kind,
      items: moveItem(current, from, to)
    };
    setDraft(draftRef.current);
  }
  function endGesture(event, cancel = false) {
    const gesture = gestureRef.current;
    if (!gesture || gesture.pointerId !== event.pointerId) return;
    clearTimeout(gesture.timer);
    gestureRef.current = null;
    const ordered = draftRef.current;
    draftRef.current = null;
    setDrag(null);
    setDraft(null);
    if (gesture.node.hasPointerCapture(event.pointerId)) gesture.node.releasePointerCapture(event.pointerId);
    if (cancel || gesture.cancelled) return;
    if (gesture.active) {
      if (!gesture.moved || !ordered) return;
      if (gesture.kind === "saved") saveGallery("order", ordered.items);else onFilesChange(ordered.items.map(preview => preview.file));
    } else {
      promote(gesture.kind, gesture.key);
    }
  }
  function keyboardMove(event, kind, key) {
    if (!event.altKey || !["ArrowLeft", "ArrowRight"].includes(event.key) || blocked || mutationLock.current) return;
    event.preventDefault();
    const items = kind === "saved" ? images : previews;
    const index = items.findIndex(item => kind === "saved" ? String(item.id) === String(key) : item.url === key);
    const target = index + (event.key === "ArrowLeft" ? -1 : 1);
    if (index < 0 || target < 0 || target >= items.length) return;
    const next = moveItem(items, index, target);
    if (kind === "saved") saveGallery("order", next);else onFilesChange(next.map(preview => preview.file));
  }
  function remove(kind, key) {
    if (blocked || mutationLock.current || gestureRef.current) return;
    if (kind === "saved") saveGallery("delete", key);else onFilesChange(previews.filter(preview => preview.url !== key).map(preview => preview.file));
  }
  function thumbnail(item, index, kind) {
    const key = kind === "saved" ? String(item.id) : item.url;
    const path = kind === "saved" ? item.file_url : item.url;
    const dragging = drag?.kind === kind && String(drag.key) === key;
    return <div key={key} data-product-thumbnail data-kind={kind} data-image-key={key} className={`relative h-16 w-16 shrink-0 rounded-xl border-2 bg-white ${index === 0 ? "border-green-500" : "border-slate-200"} ${dragging ? "scale-105 ring-4 ring-green-200" : ""}`}>
        <button type="button" disabled={blocked} aria-label={`${kind === "saved" ? "Set primary" : "Move selected image first"}: image ${index + 1}`} aria-pressed={index === 0} onPointerDown={event => startGesture(event, kind, key)} onPointerMove={moveGesture} onPointerUp={event => endGesture(event)} onPointerCancel={event => endGesture(event, true)} onLostPointerCapture={event => endGesture(event, true)} onContextMenu={event => event.preventDefault()} onKeyDown={event => keyboardMove(event, kind, key)} onClick={event => {
        if (event.detail === 0) promote(kind, key);
      }} style={{
        touchAction: "none"
      }} className="h-full w-full cursor-grab select-none overflow-hidden rounded-lg p-1 outline-none focus-visible:ring-2 focus-visible:ring-green-600 active:cursor-grabbing disabled:opacity-50">
          <ImagePreview path={path} alt={`Image ${index + 1}`} className="pointer-events-none h-full w-full object-contain" />
        </button>
        <button type="button" disabled={blocked} onClick={() => remove(kind, key)} aria-label={`${kind === "saved" ? "Delete" : "Remove selected"} image ${index + 1}`} className="absolute right-0 top-0 flex h-5 w-5 items-center justify-center rounded-full border border-white bg-red-500 text-sm leading-none text-white shadow-sm hover:bg-red-600 focus-visible:ring-2 focus-visible:ring-red-600 disabled:opacity-50">×</button>
        {index === 0 && <span className="pointer-events-none absolute bottom-0 left-0 rounded-br-lg rounded-tl-lg bg-green-600 px-1 text-[9px] leading-4 text-white">{kind === "saved" ? "Primary" : "First"}</span>}
      </div>;
  }
  const savedItems = draft?.kind === "saved" ? draft.items : images;
  const selectedItems = draft?.kind === "selected" ? draft.items : previews;
  const mainImage = savedItems[0]?.file_url || selectedItems[0]?.url || "";
  return <fieldset disabled={blocked} className="mb-6 min-w-0 max-w-full overflow-hidden rounded-2xl border border-green-100 bg-green-50/40 p-3 sm:p-4">
      <legend className="px-2 text-sm font-bold text-slate-800">Product Images</legend>
      <div className="relative mx-auto w-full max-w-xs">
        <ImagePreview path={mainImage} alt={product?.name || "Product preview"} className="h-48 w-full rounded-2xl border border-green-100 bg-white object-contain p-3 sm:h-56" />
        {(images.length === 1 || !images.length && previews.length === 1) && <button type="button" disabled={blocked} onClick={() => images.length ? remove("saved", String(images[0].id)) : remove("selected", previews[0].url)} aria-label={images.length ? "Delete image" : "Remove selected image"} className="absolute right-2 top-2 flex h-6 w-6 items-center justify-center rounded-full bg-red-500 text-lg leading-none text-white shadow hover:bg-red-600">×</button>}
        <p className="mt-2 text-center text-xs text-slate-500">{loading ? "Loading images..." : images.length ? "Primary image" : previews.length ? "Selected image preview" : "Select product images"}</p>
      </div>
      {savedItems.length > 1 && <div className="mt-4 flex w-full min-w-0 max-w-full gap-3 overflow-x-auto overflow-y-hidden px-1 py-2">{savedItems.map((item, index) => thumbnail(item, index, "saved"))}</div>}
      <label className="mt-5 block min-w-0">
        <span className="mb-2 block text-sm font-semibold text-slate-700">{product ? "Add new images" : "Select images"}</span>
        <input type="file" multiple accept="image/*" disabled={Boolean(product && !ready)} onChange={selectFiles} className="block w-full min-w-0 max-w-full text-xs text-slate-500 file:mr-2 file:rounded-lg file:border-0 file:bg-green-100 file:px-3 file:py-2 file:font-semibold file:text-green-700" />
      </label>
      <p className="mt-2 text-xs text-slate-500">Up to 10 new images per upload, 5 MB each.</p>
      {selectedItems.length > 1 && <>
        <p className="mt-4 text-xs font-semibold text-slate-600">Selected images — not uploaded yet</p>
        <div className="mt-2 flex w-full min-w-0 max-w-full gap-3 overflow-x-auto overflow-y-hidden px-1 py-2">{selectedItems.map((item, index) => thumbnail(item, index, "selected"))}</div>
      </>}
      {images.length > 0 && selectedItems.length === 1 && <div className="mt-4 flex flex-wrap justify-center gap-3">{thumbnail(selectedItems[0], 0, "selected")}</div>}
      {(images.length > 1 || previews.length > 1) && <p className="mt-3 text-center text-xs text-slate-500">Tap a saved image to make it primary. Hold a thumbnail, then drag to reorder. Keyboard: Alt + Left/Right.</p>}
      {product && <button type="button" disabled={!files.length || !ready} onClick={() => saveGallery("upload")} className="mt-4 rounded-xl bg-green-600 px-4 py-2 text-sm font-semibold text-white hover:bg-green-700 disabled:opacity-50">{busy ? "Processing..." : "Upload Images"}</button>}
      {product && !loading && !ready && <button type="button" onClick={() => setRefresh(value => value + 1)} className="mt-3 text-sm font-semibold text-green-700 underline">Retry Gallery</button>}
      {error && <p role="alert" className="mt-3 break-words text-sm text-red-600">{error}</p>}
      {message && <p role="status" className="mt-3 break-words text-sm text-green-700">{message}</p>}
      <p className="mt-3 text-xs text-slate-500">{product ? "Gallery changes save immediately. New images append to the gallery; tap an uploaded image to make it primary. Cancel does not undo saved changes." : "First selected image becomes primary after upload. Selected image order is saved when images upload."}</p>
    </fieldset>;
}
