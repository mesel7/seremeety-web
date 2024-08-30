import { useContext, useState } from "react";
import BottomMenu from "../components/common/BottomMenu";
import PageHeader from "../components/common/PageHeader";
import RequestContent from "../components/request/RequestContent";
import { RequestStateContext } from "../contexts/RequestContext";

const Request = () => {
    const state = useContext(RequestStateContext);
    const [isReceived, setIsReceived] = useState(true);
    console.log(state);

    return (
        <div className="Request">
            <PageHeader page={"request"} isReceived={isReceived} setIsReceived={setIsReceived} />
            <RequestContent requests={state} isReceived={isReceived} />
            <BottomMenu />
        </div>
    );
};

export default Request;