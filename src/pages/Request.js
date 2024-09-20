import { useContext, useRef, useState } from "react";
import BottomMenu from "../components/common/BottomMenu";
import PageHeader from "../components/common/PageHeader";
import RequestContent from "../components/request/RequestContent";
import { RequestStateContext } from "../contexts/RequestContext";
import useElementHeight from "../hooks/useElementHeight";

const Request = () => {
    const state = useContext(RequestStateContext);
    const [isReceived, setIsReceived] = useState(true);
    const headerRef = useRef(null);
    const footerRef = useRef(null);
    const contentHeight = useElementHeight(headerRef, footerRef);
    console.log(state);

    return (
        <div className="Request">
            <PageHeader ref={headerRef} page={"request"} isReceived={isReceived} setIsReceived={setIsReceived} />
            <RequestContent requests={state} isReceived={isReceived} style={{ height: contentHeight }} />
            <BottomMenu ref={footerRef} />
        </div>
    );
};

export default Request;