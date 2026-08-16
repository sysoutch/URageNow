function createDashboardMusicThinkingHelpers(input) {
  const request = typeof input?.request === "function" ? input.request : async () => {
    throw new Error("Dashboard request helper is not available.");
  };
  const setMusicGenerationStatus = typeof input?.setMusicGenerationStatus === "function" ? input.setMusicGenerationStatus : () => {};
  const setOutput = typeof input?.setOutput === "function" ? input.setOutput : () => {};
  function setButtonState(buttonId, running, label) {
    const button = document.getElementById(buttonId);
    if (!button) return;
    button.disabled = running === true;
    button.querySelector("[data-music-thinking-label]")?.replaceChildren(running ? "Thinking..." : label);
  }
  function mergeTags(existing, suggested) {
    const tags = [];
    const known = new Set();
    [existing, suggested].forEach(value => String(value || "").split(",").forEach(tag => {
      const normalized = tag.trim();
      const key = normalized.toLowerCase();
      if (normalized && !known.has(key)) {
        known.add(key);
        tags.push(normalized);
      }
    }));
    return tags.join(", ");
  }
  function bindMusicThinkingActions() {
    document.getElementById("musicgen-think-tags-button")?.addEventListener("click", async event => {
      event.preventDefault();
      const tagsNode = document.getElementById("musicgen-tags");
      const existingTags = String(tagsNode?.value || "").trim();
      setButtonState("musicgen-think-tags-button", true, "Let LLM Think About Music Tags");
      setMusicGenerationStatus("Asking LazyDev to expand music tags...");
      try {
        const response = await request("/api/music-think", { kind: "tags", existing: existingTags });
        const suggestedTags = String(response?.result || "").trim().replace(/^['\"`]+|['\"`]+$/g, "");
        if (!suggestedTags) throw new Error("LazyDev returned no music tags.");
        if (tagsNode) {
          tagsNode.value = mergeTags(existingTags, suggestedTags);
          tagsNode.dispatchEvent(new Event("input", { bubbles: true }));
          tagsNode.dispatchEvent(new Event("change", { bubbles: true }));
        }
        setMusicGenerationStatus("Music tags expanded.");
        setOutput("LazyDev expanded the music tags.");
      } catch (error) {
        const detail = error?.message || "Unknown error";
        setMusicGenerationStatus("Music tag suggestion failed.");
        setOutput("Failed to expand music tags: " + detail);
      } finally {
        setButtonState("musicgen-think-tags-button", false, "Let LLM Think About Music Tags");
      }
    });
    document.getElementById("musicgen-think-lyrics-button")?.addEventListener("click", async event => {
      event.preventDefault();
      const lyricsNode = document.getElementById("musicgen-lyrics");
      const existingLyrics = String(lyricsNode?.value || "").trim();
      setButtonState("musicgen-think-lyrics-button", true, "Let LLM Think About Lyrics");
      setMusicGenerationStatus("Asking LazyDev to develop lyrics...");
      try {
        const response = await request("/api/music-think", { kind: "lyrics", existing: existingLyrics });
        const draftedLyrics = String(response?.result || "").trim().replace(/^['\"`]+|['\"`]+$/g, "");
        if (!draftedLyrics) throw new Error("LazyDev returned no lyrics.");
        if (lyricsNode) {
          lyricsNode.value = existingLyrics && !draftedLyrics.includes(existingLyrics) ? existingLyrics + "\n\n" + draftedLyrics : draftedLyrics;
          lyricsNode.dispatchEvent(new Event("input", { bubbles: true }));
          lyricsNode.dispatchEvent(new Event("change", { bubbles: true }));
        }
        setMusicGenerationStatus("Lyrics drafted.");
        setOutput("LazyDev developed the lyrics.");
      } catch (error) {
        const detail = error?.message || "Unknown error";
        setMusicGenerationStatus("Lyrics draft failed.");
        setOutput("Failed to develop lyrics: " + detail);
      } finally {
        setButtonState("musicgen-think-lyrics-button", false, "Let LLM Think About Lyrics");
      }
    });
  }
  return { bindMusicThinkingActions };
}
