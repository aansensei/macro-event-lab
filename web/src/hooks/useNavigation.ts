import { useEffect, useState } from "react";

import { pageSearch, parseUrlState, type Page } from "../lib/url";

export function useNavigation() {
  const [route, setRoute] = useState(() => parseUrlState(window.location.search));
  const [navigationKey, setNavigationKey] = useState(0);

  useEffect(() => {
    const restore = () => {
      setRoute(parseUrlState(window.location.search));
      setNavigationKey((key) => key + 1);
    };
    window.addEventListener("popstate", restore);
    return () => window.removeEventListener("popstate", restore);
  }, []);

  function navigate(page: Page) {
    const search = pageSearch(page);
    window.history.pushState(null, "", search);
    setRoute(parseUrlState(search));
    setNavigationKey((key) => key + 1);
    window.scrollTo(0, 0);
  }

  return { route, navigate, navigationKey };
}
