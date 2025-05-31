import { useRef } from "react";
import PageHeader from "../components/common/PageHeader";
import PageTransition from "../components/common/PageTransition";
import SettingContent from "../components/setting/SettingContent";
import useElementHeight from "../hooks/useElementHeight";

const Setting = () => {
    const headerRef = useRef(null);
    const footerRef = useRef(null);
    const contentHeight = useElementHeight(headerRef, footerRef);

    return (
        <div className="Setting">
            <PageTransition>
                <PageHeader ref={headerRef} page={"setting"} />
                <SettingContent style={{ height: contentHeight }} />
            </PageTransition>
        </div>
    );
};

export default Setting;