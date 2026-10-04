import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { Download, Printer } from "lucide-react";
import { StoreLogo } from "@/components/delivery/StoreCard";
import { Button } from "@/components/ui/button";
import type { DeliveryStore } from "@/lib/delivery";
import { qrSvg } from "@/lib/qr";
import { readableOn } from "@/lib/storefront";

/** Cartel A4 con el QR de la tienda: se ve en pantalla como vista previa y se imprime tal cual (o se baja el QR en SVG para la imprenta). */
export function QrPoster({ store, url, color, title }: { store: DeliveryStore; url: string; color: string; title: string }) {
  const svg = useMemo(() => qrSvg(url), [url]);
  const [portal, setPortal] = useState<HTMLElement | null>(null);
  const on = readableOn(color);
  useEffect(() => { setPortal(document.body); }, []);

  const print = () => {
    document.body.classList.add("printing-poster");
    const clean = () => { document.body.classList.remove("printing-poster"); window.removeEventListener("afterprint", clean); };
    window.addEventListener("afterprint", clean);
    window.print();
  };
  const download = () => {
    const blob = new Blob([svg], { type: "image/svg+xml" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `qr-${store.slug}.svg`;
    link.click();
    URL.revokeObjectURL(link.href);
  };

  const poster = (
    <div className="flex h-full w-full flex-col items-center justify-between bg-white text-center text-black" style={{ fontFamily: "system-ui, sans-serif" }}>
      <div className="w-full px-[8%] py-[7%]" style={{ background: color, color: on }}>
        <p className="text-[1.3em] font-semibold uppercase tracking-[0.25em] opacity-90">Pedí online</p>
        <p className="mt-[2%] text-[3.2em] font-black leading-[1.05]">{title}</p>
      </div>
      <div className="flex flex-col items-center px-[10%]">
        <div className="w-[62%] rounded-[4%] border-[0.35em] p-[2%]" style={{ borderColor: color }} dangerouslySetInnerHTML={{ __html: svg }} />
        <p className="mt-[4%] text-[2.4em] font-extrabold">Escaneá y pedí</p>
        <p className="mt-[1%] text-[1.35em] text-neutral-600">Apuntá la cámara del celular al código. Sin instalar nada.</p>
      </div>
      <div className="w-full px-[8%] pb-[5%]">
        <p className="break-all text-[1.5em] font-bold">{url.replace(/^https?:\/\//, "")}</p>
        <p className="mt-[1.5%] text-[1.05em] uppercase tracking-widest text-neutral-500">Tienda online creada en Woref</p>
      </div>
    </div>
  );

  return (
    <div>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
        <div className="w-full max-w-[210px] shrink-0 overflow-hidden rounded-xl border shadow-soft" style={{ aspectRatio: "210 / 297", fontSize: "5.6px" }} aria-label="Vista previa del cartel">{poster}</div>
        <div className="min-w-0 space-y-3">
          <div className="flex items-center gap-3"><StoreLogo store={store} className="h-10 w-10 text-sm" /><p className="font-bold">{store.nombre}</p></div>
          <p className="text-sm text-muted-foreground">Imprimilo y pegalo en la vidriera, el mostrador o las bolsas. Quien lo escanea entra directo a tu tienda y puede pedir.</p>
          <div className="flex flex-wrap gap-2">
            <Button type="button" className="rounded-full font-bold" onClick={print}><Printer className="h-4 w-4" />Imprimir cartel (A4)</Button>
            <Button type="button" variant="outline" className="rounded-full font-bold" onClick={download}><Download className="h-4 w-4" />Bajar QR (SVG)</Button>
          </div>
        </div>
      </div>
      {portal && createPortal(<div id="poster-print" style={{ fontSize: "21.2px" }} aria-hidden>{poster}</div>, portal)}
    </div>
  );
}
