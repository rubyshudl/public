(() => {
  const polish = () => {
    document.querySelectorAll("img").forEach((image) => {
      const source = image.getAttribute("src");
      if (source?.startsWith("/") && !source.startsWith("//")) {
        image.setAttribute("src", `./${source.slice(1)}`);
      }
    });

    document.querySelectorAll("span, p").forEach((node) => {
      if (node.childElementCount) return;
      if (node.textContent === "BonVoyage") node.textContent = "BONVOYAGE";
      if (node.textContent === "Book your trip across Europe") node.textContent = "Europe, effortlessly";
    });
  };

  const observer = new MutationObserver(polish);
  observer.observe(document.getElementById("root"), { childList: true, subtree: true });
  polish();
})();
