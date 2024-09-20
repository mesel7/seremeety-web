import Swal from "sweetalert2";
import { auth } from "../../firebase";
import { icons, isRequestExist } from "../../utils";
import Button from "../common/Button";
import "./ProfileContent.css";
import React, { useState } from "react";
import ImageLoading from "../common/ImageLoading";
import { useNavigate } from "react-router-dom";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";

const ProfileContent = ({ userProfile, uid, isViewOnly, onCreateRequest, myProfile, onUpdateCoin, style }) => {
    const [isImgLoaded, setIsImgLoaded] = useState(false);
    const navigate = useNavigate();

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
                    if (myProfile.coin < 10) {
                        const result = await Swal.fire({
                            title: "음표 부족",
                            text: "음표가 부족해요 상점으로 이동할까요?",
                            icon: "warning",
                            showCancelButton: true,
                            confirmButtonText: "확인",
                            cancelButtonText: "취소",
                            showCloseButton: true,
                            reverseButtons: true,
                            customClass: {
                                confirmButton: 'no-focus-outline',
                                cancelButton: 'no-focus-outline'
                            },
                        });
        
                        if (result.isConfirmed) {
                            navigate("/shop");
                        }
                        return;
                    }

                    onCreateRequest(currentUserUid, uid);
                    onUpdateCoin({ ...myProfile, coin: myProfile.coin - 10 })
                    Swal.fire({
                        title: "매칭 요청",
                        text: "성공적으로 전송되었어요!",
                        icon: "success",
                        confirmButtonText: "확인",
                        customClass: {
                            confirmButton: 'no-focus-outline'
                        }
                    });
                } else {
                    Swal.fire({
                        title: "매칭 요청",
                        text: "이미 보내셨거나 받으신 요청이 있어요",
                        icon: "warning",
                        confirmButtonText: "확인",
                        customClass: {
                            confirmButton: 'no-focus-outline'
                        },
                    });
                }
            } catch (error) {
                console.log(error);
            }
        }
    };

    return (
        <div className="ProfileContent" style={style}>
            <div className="img_section">
                {!isImgLoaded && <ImageLoading borderRadius={"5px"} />}
                <img
                    alt="PROFILE"
                    src={userProfile["profilePictureUrl"]}
                    onLoad={() => setIsImgLoaded(true)}
                    style={{ display: !isImgLoaded ? "none" : "block" }}
                />
            </div>
            <div className="info_section_upper">
                <div className="nickname_wrapper">{userProfile.nickname}</div>
                <div className="age_gender_wrapper">
                    {userProfile.age}
                    <FontAwesomeIcon
                        icon={userProfile.gender === "male" ? icons.faMars : icons.faVenus}
                        style={{ color: userProfile.gender === "male" ? "#92a8d1" : "#f7cac9" }}
                    />
                </div>
            </div>
            <div className="info_section_lower">
                <div className="info_wrapper">
                    <FontAwesomeIcon icon={icons.faHeartSolid} />
                    {userProfile.mbti}
                </div>
                <div className="info_wrapper">
                    <FontAwesomeIcon icon={icons.faGraduationCap} />
                    {userProfile.university}
                </div>
                <div className="info_wrapper">
                    <FontAwesomeIcon icon={icons.faLocationArrow} />
                    {userProfile.place}
                </div>
            </div>
            <div className="introduce_section">
                <div className="introduce_label">
                    <FontAwesomeIcon icon={icons.faUserSolid} />
                    자기소개
                </div>
                <div className="introduce_wrapper">
                    {userProfile.introduce.split('\n').map((line, idx) => (
                        <React.Fragment key={idx}>
                            {line}
                            <br/>
                        </React.Fragment>
                    ))}
                </div>
            </div>
            {!isViewOnly && <Button text={"매칭 요청"} onClick={handleRequestClick} />}
        </div>
    );
};

export default ProfileContent;