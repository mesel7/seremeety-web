import Swal from "sweetalert2";
import { auth } from "../../firebase";
import { isRequestExist, profileInfo } from "../../utils";
import Button from "../common/Button";
import "./ProfileContent.css";
import ProfileInfo from "./ProfileInfo";

const ProfileContent = ({ userProfile, uid, isViewOnly, onCreateRequest }) => {
    const handleRequestClick = async () => {
        const currentUserUid = auth.currentUser.uid;
        const result = await Swal.fire({
            title: "매칭 요청",
            text: "요청을 보내시겠어요? · 10음표",
            icon: "question",
            showCancelButton: true,
            confirmButtonText: "확인",
            cancelButtonText: "취소",
            showCloseButton: true,
            reverseButtons: true
        });
        
        if (result.isConfirmed) {
            try {
                if (!await isRequestExist(currentUserUid, uid)) {
                    onCreateRequest(currentUserUid, uid);
                    Swal.fire({
                        title: "매칭 요청",
                        text: "성공적으로 전송되었어요!",
                        icon: "success",
                        confirmButtonText: "확인"
                    });
                } else {
                    Swal.fire({
                        title: "매칭 요청",
                        text: "이미 보내셨거나 받으신 요청이 있어요",
                        icon: "warning",
                        confirmButtonText: "확인"
                    });
                }
            } catch (error) {
                console.log(error);
            }
        }
    };

    return (
        <div className="ProfileContent">
            <img alt="PROFILE" src={userProfile["profilePictureUrl"] || "/logo192.png"} />
            {profileInfo.map((it, idx) => <ProfileInfo key={idx} {...it} data={userProfile[it.id]} />)}
            {!isViewOnly && <Button text={"매칭 요청"} onClick={handleRequestClick} />}
        </div>
    );
};

export default ProfileContent;