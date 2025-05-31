import { useCallback, useEffect, useRef, useState } from "react";
import { compressImage, getAgeByBirthDate, mypageForm } from "../../utils";
import "./MypageContent.css";
import MypageForm from "./MypageForm";
import CropperModal from "../cropper/CropperModal";
import ImageLoading from "../common/ImageLoading";

const MypageContent = ({ userProfile, setFormData, style }) => {
    const [isImgLoaded, setIsImgLoaded] = useState(false);
    const [selectedImage, setSelectedImage] = useState(null);
    const [croppedImage, setCroppedImage] = useState(null);
    const [openCropper, setOpenCropper] = useState(false);
    const imageUploadRef = useRef(null);

    useEffect(() => {
        if (userProfile) {
            setFormData(userProfile);
        }
    }, [userProfile]);

    const handleFormDataChange = useCallback((id, data) => {
        setFormData(prevState => {
            const updatedData = { ...prevState, [id]: data };
            if (id === "birthdate") {
                updatedData["age"] = data ? `${getAgeByBirthDate(data)}세` : ""; 
            }
            return updatedData;
        });
    }, [setFormData]);    

    const handleSelectImage = async (e) => {
        const file = e.target.files[0];
        if (file) {
            try {
                const compressedFile = await compressImage(file);
                setSelectedImage(URL.createObjectURL(compressedFile));
                setOpenCropper(true);
            } catch (error) {
                console.log(error);
            }
        }
    };

    const handleCropComplete = () => {
        setFormData({ ...userProfile, profilePictureUrl: croppedImage });
        setOpenCropper(false);
    };
    
    return (
        <div className="MypageContent" style={style}>
            {openCropper && (
                <CropperModal
                selectedImage={selectedImage}
                setCroppedImage={setCroppedImage}
                setOpenCropper={setOpenCropper}
                handleCropComplete={handleCropComplete}
                />
            )}
            <div className="img_section">
                {!isImgLoaded && <ImageLoading borderRadius={"5px"} />}
                <img
                    alt="PROFILE"
                    src={userProfile["profilePictureUrl"]}
                    onClick={() => imageUploadRef.current.click()}
                    onLoad={() => setIsImgLoaded(true)}
                    style={{ display: !isImgLoaded ? "none" : "block" }}
                />
            </div>
            <input
                type="file"
                ref={imageUploadRef}
                accept="image/*" 
                style={{ display: "none" }}
                onChange={handleSelectImage}
            />
            {mypageForm.map((it, idx) => (
                <MypageForm
                    key={idx}
                    {...it}
                    data={userProfile[it.id]}
                    onChange={handleFormDataChange}
                    isDisabled={userProfile["profileStatus"]}
                />
            ))}
        </div>
    );
};

export default MypageContent;