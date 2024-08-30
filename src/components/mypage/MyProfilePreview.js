import { useState } from "react";
import ImageLoading from "../common/ImageLoading";
import "./MyProfilePreview.css";
import { useNavigate } from "react-router-dom";
import Button from "../common/Button";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { icons } from "../../utils";

const MyProfilePreview = ({ userProfile }) => {
    const [isImgLoaded, setIsImgLoaded] = useState(false);
    const navigate = useNavigate();

    return (
        <div className="MyProfilePreview">
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
                        <FontAwesomeIcon icon={icons.faCakeCandles} size={"2x"} style={{ color: "gray" }} />
                        {userProfile.age}
                    </div>
                    <div className="info_wrapper">
                        <FontAwesomeIcon icon={icons.faHeartSolid} size={"2x"} style={{ color: "gray" }} />
                        {userProfile.mbti}
                    </div>
                    <div className="info_wrapper">
                        <FontAwesomeIcon icon={icons.faLocationArrow} size={"2x"} style={{ color: "gray" }} />
                        {userProfile.place}
                    </div>
                </div>
                <Button text={"프로필 수정"} onClick={() => navigate("/my-profile")} />
            </div>
        </div>
    );
};

export default MyProfilePreview;