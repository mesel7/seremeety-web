import { useNavigate } from "react-router-dom";
import { formatTimeStampForList } from "../../utils";
import Button from "../common/Button";
import "./RequestItem.css";
import Swal from "sweetalert2";
import { useState } from "react";

const RequestItem = ({ request, onUpdateRequest }) => {
    const [requestStatus, setRequestStatus] = useState(request.status);
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

    return (
        <div className="RequestItem">
            <div className="img_section" onClick={handleProfilePictureClick}>
                <img alt={"PROFILE"} src={request.profilePictureUrl || "/logo192.png"} />
            </div>
            <div className="content_section">
                <div className="info_wrapper">
                    <div className="nickname_wrapper">{request.nickname}</div>
                    <div className="created_at_wrapper">{formatTimeStampForList(request.createdAt)}</div>
                </div>
                <div className="status_wrapper">
                    <Button text={statusText} onClick={handleRequestStatusClick} />
                </div>
            </div>
        </div>
    );
};

export default RequestItem;