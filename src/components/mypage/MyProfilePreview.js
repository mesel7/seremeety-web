import { useState } from "react";
import ImageLoading from "../common/ImageLoading";
import "./MyProfilePreview.css";
import { useNavigate } from "react-router-dom";
import Button from "../common/Button";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { icons } from "../../utils";
import { auth } from "../../firebase";

const MyProfilePreview = ({ userProfile }) => {
    const [isImgLoaded, setIsImgLoaded] = useState(false);
    const navigate = useNavigate();

    return (
        <div className="MyProfilePreview">
            <div className="preview_section">
                <div className="img_nickname_section">
                    <div className="img_wrapper">
                        {!isImgLoaded && <ImageLoading />}
                        <img
                            alt="PROFILE"
                            src={userProfile.profilePictureUrl}
                            onLoad={() => setIsImgLoaded(true)}
                            style={{ display: !isImgLoaded ? "none" : "block" }}
                        />
                    </div>
                    <div className="nickname_wrapper">{userProfile.nickname}</div>
                </div>
                <div className="content_section">
                    <div className="info_section">
                        <div className="info_wrapper">
                            <FontAwesomeIcon icon={icons.faCakeCandles} size={"2x"} />
                            <div className="text_wrapper">{userProfile.age}</div>
                        </div>
                        <div className="info_wrapper">
                            <FontAwesomeIcon icon={icons.faHeartSolid} size={"2x"} />
                            <div className="text_wrapper">{userProfile.mbti}</div>
                        </div>
                        <div className="info_wrapper">
                            <FontAwesomeIcon icon={icons.faLocationArrow} size={"2x"} />
                            <div className="text_wrapper">{userProfile.place}</div>
                        </div>
                    </div>
                    <div className="link_section">
                        <div
                            className="link_wrapper"
                            onClick={() => navigate(`/profile/${auth.currentUser.uid}`, { state: { isViewOnly: true }})}
                        >
                            미리보기
                            <FontAwesomeIcon icon={icons.faAngleRight} />
                        </div>
                    </div>
                </div>
            </div>
            <div className="menu_section">
                <Button text={"프로필 수정"} onClick={() => navigate("/my-profile")} />
                <Button text={"셀소 만들기"} />
            </div>
        </div>
    );
};

export default MyProfilePreview;