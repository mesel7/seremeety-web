import { useNavigate } from "react-router-dom";
import "./ProfileCardItem.css";
import { useState } from "react";
import ImageLoading from "../common/ImageLoading";
import React from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { icons } from "../../utils";
import sereMeetyLogo from "../../images/img_seremeety_logo.png";

const ProfileCardItem = ({ uid, profilePictureUrl, nickname, age, gender, place, profileStatus }) => {
    const [isImgLoaded, setIsImgLoaded] = useState(false);
    const navigate = useNavigate();
    const handleProfileCardClick = () => {
        navigate(`/profile/${uid}`);
    };

    return (
        <div className="ProfileCardItem" onClick={handleProfileCardClick}>
            <div className="img_section">
                {!isImgLoaded && <ImageLoading borderRadius={"5px"} />}
                <img
                    alt="PROFILE"
                    src={profileStatus === 1 ? profilePictureUrl : sereMeetyLogo}
                    onLoad={() => setIsImgLoaded(true)}
                    style={{ display: !isImgLoaded ? "none" : "block" }}
                />
            </div>
            <div
                className="content_section"
                style={{
                    visibility: profileStatus === 1 ? 'visible' : 'hidden',
                }}
            >
                <div className="nickname_wrapper">
                    {profileStatus === 1 ? nickname : "nickname"}
                </div>
                <div className="age_gender_wrapper">
                    {profileStatus === 1 ? age : "age"}
                    {profileStatus === 1 && (
                        <FontAwesomeIcon
                            icon={gender === "male" ? icons.faMars : icons.faVenus}
                            style={{ color: gender === "male" ? "#92a8d1" : "#f7cac9" }}
                        />
                    )}
                    {profileStatus === 1 ? place.split(" ")[0] : "place"}
                </div>
            </div>
        </div>
    );
};

export default React.memo(ProfileCardItem);