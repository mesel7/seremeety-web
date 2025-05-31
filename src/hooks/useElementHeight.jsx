import { useState, useEffect, useCallback } from "react";

const useElementHeight = (headerRef, footerRef) => {
    const [contentHeight, setContentHeight] = useState(0);

    const calculateHeight = useCallback(() => {
        const headerHeight = headerRef?.current?.offsetHeight || 0;
        const footerHeight = footerRef?.current?.offsetHeight || 0;
        const windowHeight = window.innerHeight;
        setContentHeight(windowHeight - headerHeight - footerHeight);
    }, [headerRef, footerRef]);

    useEffect(() => {
        calculateHeight();
        window.addEventListener("resize", calculateHeight);

        return () => {
            window.removeEventListener("resize", calculateHeight);
        };
    });

    return contentHeight;
};

export default useElementHeight;
