(function () {
  const config = window.SHITORI_ADS || {};
  const client = typeof config.client === "string" ? config.client.trim() : "";
  const nativeSlot = typeof config.nativeSlot === "string" ? config.nativeSlot.trim() : "";
  const bannerSlot = typeof config.bannerSlot === "string" ? config.bannerSlot.trim() : "";

  if (!client) {
    return;
  }

  loadAdsenseScript(client);

  if (nativeSlot) {
    mountAd("nativeAdMount", {
      client,
      slot: nativeSlot,
      format: "fluid",
      responsive: true
    });
  }

  if (bannerSlot) {
    mountAd("bannerAdMount", {
      client,
      slot: bannerSlot,
      format: "auto",
      responsive: true
    });
  }

  function loadAdsenseScript(adClient) {
    if (
      document.querySelector('script[data-shiritori-adsense="true"]') ||
      document.querySelector('script[src*="adsbygoogle.js"]')
    ) {
      return;
    }

    const script = document.createElement("script");
    script.async = true;
    script.src = "https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=" + encodeURIComponent(adClient);
    script.crossOrigin = "anonymous";
    script.setAttribute("data-shiritori-adsense", "true");
    document.head.appendChild(script);
  }

  function mountAd(targetId, options) {
    const mount = document.getElementById(targetId);
    if (!mount) {
      return;
    }

    mount.innerHTML = "";

    const ad = document.createElement("ins");
    ad.className = "adsbygoogle shiritori-ad-slot";
    ad.style.display = "block";
    ad.setAttribute("data-ad-client", options.client);
    ad.setAttribute("data-ad-slot", options.slot);
    ad.setAttribute("data-full-width-responsive", options.responsive ? "true" : "false");
    ad.setAttribute("data-ad-format", options.format);
    mount.appendChild(ad);

    const pushAd = function () {
      try {
        (window.adsbygoogle = window.adsbygoogle || []).push({});
      } catch (error) {
        console.error("AdSense render failed", error);
      }
    };

    if (document.readyState === "complete") {
      window.setTimeout(pushAd, 0);
      return;
    }

    window.addEventListener("load", function handleLoad() {
      window.removeEventListener("load", handleLoad);
      pushAd();
    });
  }
})();
