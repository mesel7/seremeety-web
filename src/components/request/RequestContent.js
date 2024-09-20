import { useContext, useEffect, useState } from "react";
import "./RequestContent.css";
import RequestItem from "./RequestItem";
import { getUserDataByUid } from "../../utils";
import { RequestDispatchContext } from "../../contexts/RequestContext";
import { ChatDispatchContext } from "../../contexts/ChatContext";
import Loading from "../common/Loading";

const RequestContent = ({ requests, isReceived, style }) => {
    const { onUpdate } = useContext(RequestDispatchContext);
    const { onCreate } = useContext(ChatDispatchContext);
    const [enhancedRequests, setEnhancedRequests] = useState([]);
    const [isDataLoaded, setIsDataLoaded] = useState(false);

    const addProfileDataInRequest = async (request) => {
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
            setEnhancedRequests(await Promise.all(sortedRequests.map(addProfileDataInRequest)));
            setIsDataLoaded(true);
        };

        enhanceRequests();
    }, [requests, isReceived]);

    if (!isDataLoaded) {
        return <Loading />;
    } else {
        return (
            <div className="RequestContent" style={style}>
                {enhancedRequests.length <= 0 ?
                    <div className="empty_content">
                        {isReceived ? "아직 받은 요청이 없어요" : "아직 보낸 요청이 없어요"}
                    </div> :
                    enhancedRequests.map((it) => (
                        <RequestItem
                            key={it.id}
                            request={it}
                            onUpdateRequest={onUpdate}
                            onCreateChatRoom={onCreate}
                        />
                    ))
                }
            </div>
        );
    }
};

export default RequestContent;