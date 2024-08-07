import { useEffect, useState } from "react";
import { getAgeByBirthDate, mypageForm } from "../../utils";
import Button from "../common/Button";
import "./MypageContent.css";
import MypageForm from "./MypageForm";

const MypageContent = ({ userProfile, onSave }) => {
    const [formData, setFormData] = useState({});

    useEffect(() => {
        if (userProfile) {
            setFormData(userProfile);
        }
    }, [userProfile]);

    const handleFormDataChange = (id, data) => {
        const updatedData = { ...formData, [id]: data };
        if (id === "birthdate") {
            updatedData["age"] = data ? `${getAgeByBirthDate(data)}세` : ""; 
        }

        setFormData(updatedData);
    };

    const handleSave = () => {
        onSave(formData);
    };

    return (
        <div className="MypageContent">
            <img alt="PROFILE" src={formData["profilePictureUrl"] || "/logo192.png"} />
            {mypageForm.map((it, idx) => (
                <MypageForm
                    key={idx}
                    {...it}
                    data={formData[it.id]}
                    onChange={handleFormDataChange}
                    isDisabled={formData["profileStatus"]}
                />
            ))}
            <Button text={"저장하기"} onClick={handleSave} />
        </div>
    );
};

export default MypageContent;