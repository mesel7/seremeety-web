import { useContext, useEffect, useState } from "react";
import "./RequestContent.css";
import RequestItem from "./RequestItem";
import { getUserDataByUid } from "../../utils";
import { RequestDispatchContext } from "../../contexts/RequestContext";

const RequestContent = ({ requests, isReceived }) => {
    const { onUpdate } = useContext(RequestDispatchContext);
    const [enhancedRequests, setEnhancedRequests] = useState([]);

    const addProfileDataInRequests = async (request) => {
        const otherUserUid = isReceived ? request.from : request.to;
        try {
            const otherUserData = await getUserDataByUid(otherUserUid);
            return {
                ...request,
                nickname: otherUserData.nickname,
                profilePictureUrl: otherUserData.profilePictureUrl,
                isReceived
            };
        } catch (error) {
            console.log(error);
            return request;
        }
    };

    useEffect(() => {
        const enhanceRequests = async () => {
            const sortedRequests = isReceived ? requests.receivedRequests : requests.sentRequests;
            setEnhancedRequests(await Promise.all(sortedRequests.map(addProfileDataInRequests)));
        };

        enhanceRequests();
    }, [requests, isReceived]);

    return (
        <div className="RequestContent">
            {enhancedRequests.map((it) => <RequestItem key={it.id} request={it} onUpdateRequest={onUpdate} />)}
        </div>
    );
};

export default RequestContent;