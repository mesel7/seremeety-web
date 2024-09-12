import { useNavigate } from "react-router-dom";
import { formatTimeStampForList, icons } from "../../utils";
import "./RequestItem.css";
import Swal from "sweetalert2";
import { useState } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import ImageLoading from "../common/ImageLoading";

const RequestItem = ({ request, onUpdateRequest, onCreateChatRoom }) => {
    const [requestStatus, setRequestStatus] = useState(request.status);
    const [isImgLoaded, setIsImgLoaded] = useState(false);
    const navigate = useNavigate();
    
    const handleProfilePictureClick = () => {
        const otherUserUid = request.isReceived ? request.from : request.to;
        navigate(`/profile/${otherUserUid}`, { state: { isViewOnly: true }});
    };

    const handleRequestUpdate = async (newStatus) => {
        setRequestStatus(newStatus);
        await onUpdateRequest(request.id, {
            createdAt: request.createdAt,
            from: request.from,
            status: newStatus,
            to: request.to
        });

        if (newStatus === "accepted") {
            await onCreateChatRoom(request.to, request.from);
        }

        await Swal.fire({
            title: { accepted: "매칭 수락", rejected: "요청 거절" }[newStatus],
            text: { accepted: "매칭을 수락하셔서 채팅방이 생성되었어요!", rejected: "매칭을 거절하셨어요" }[newStatus],
            icon: { accepted: "success", rejected: "error" }[newStatus],
            confirmButtonText: "확인"
        });
    };

    const handleRequestStatusClick = async () => {
        if (!request.isReceived || requestStatus !== "pending") {
            await Swal.fire({
                title: "매칭",
                text: {
                    pending: "매칭 대기 중이에요",
                    accepted: "수락된 매칭이에요",
                    rejected: "성사되지 않은 매칭이에요"
                }[requestStatus],
                icon: "info",
                confirmButtonText: "확인"
            });
        } else {
            const result = await Swal.fire({
                title: "매칭 요청",
                text: "요청을 수락할까요?",
                icon: "question",
                showCancelButton: true,
                confirmButtonText: "수락",
                cancelButtonText: "거절",
                showCloseButton: true,
                reverseButtons: true
            });
        
            if (result.isConfirmed) {
                await handleRequestUpdate("accepted");
            } else if (result.dismiss === Swal.DismissReason.cancel) {
                await handleRequestUpdate("rejected");
            }
        }
    };

    const statusText = { pending: "매칭 대기", accepted: "매칭 수락", rejected: "매칭 실패" }[requestStatus];
    const StatusIcon = {
        pending: {
            icon: icons.faCircleQuestion,
            color: "gray"
        },
        accepted: {
            icon: icons.faCircleCheck,
            color: "#a5dc86"
        },
        rejected: {
            icon: icons.faCircleXmark,
            color: "#f27474"
        }
    }[requestStatus];

    return (
        <div className="RequestItem">
            <div className="img_section" onClick={handleProfilePictureClick}>
                {!isImgLoaded && <ImageLoading />}
                <img
                    alt={"PROFILE"}
                    src={request.profilePictureUrl}
                    onLoad={() => setIsImgLoaded(true)}
                    style={{ display: !isImgLoaded ? "none" : "block" }}
                />
            </div>
            <div className="content_section">
                <div className="info_wrapper">
                    <div className="nickname_wrapper">{request.nickname}</div>
                    <div className="created_at_wrapper">{formatTimeStampForList(request.createdAt)}</div>
                </div>
                <div className="status_wrapper" onClick={handleRequestStatusClick}>
                    <div className="icon_wrapper">
                        <FontAwesomeIcon icon={StatusIcon.icon} size={"2x"} style={{ color: StatusIcon.color }} />
                    </div>
                    <div className="text_wrapper">
                        {statusText}
                        {requestStatus === "pending" && <div className="pending_progressbar" />}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default RequestItem;