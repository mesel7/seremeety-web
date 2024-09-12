import { useContext, useEffect, useState } from "react";
import { MypageDispatchContext, MypageStateContext } from "../contexts/MypageContext";
import PageHeader from "../components/common/PageHeader";
import MypageContent from "../components/mypage/MypageContent";
import Loading from "../components/common/Loading";
import PageTransition from "../components/common/PageTransition";
import { validationRules } from "../utils";
import Swal from "sweetalert2";
import _ from "lodash";
import { useNavigate } from "react-router-dom";

const MyProfile = () => {
    const state = useContext(MypageStateContext);
    const navigate = useNavigate();
    console.log(state);
    const { onUpdate } = useContext(MypageDispatchContext);
    const [formData, setFormData] = useState({});

    useEffect(() => {
        setFormData(state);
    }, [state]);

    const onSave = async (formData) => {
        if (_.isEqual(state, formData)) {
            Swal.fire({
                title: "프로필 저장",
                icon: "info",
                text: "프로필 수정 사항이 없어요",
                confirmButtonText: "확인",
                customClass: {
                    confirmButton: 'no-focus-outline'
                }
            });
            return;
        }

        for (const field in formData) {
            const validation = validationRules[field];
            if (validation) {
                const result = await validation(formData[field]);
                if (result !== true) {
                    Swal.fire({
                        title: "프로필 저장 실패",
                        icon: "warning",
                        text: result,
                        confirmButtonText: "확인",
                        customClass: {
                            confirmButton: 'no-focus-outline'
                        }
                    });
                    return;
                }
            }
        }

        if (state.profileStatus !== 1) {
            const result = await Swal.fire({
                title: "프로필 저장",
                icon: "question",
                html: "나이, 성별은 이후에 수정이 어렵습니다<br>정말 저장할까요?",
                showCancelButton: true,
                confirmButtonText: "확인",
                cancelButtonText: "취소",
                showCloseButton: true,
                reverseButtons: true,
                customClass: {
                    confirmButton: 'no-focus-outline',
                    cancelButton: 'no-focus-outline'
                }
            });
            if (!result.isConfirmed) {
                return;
            }
        }

        onUpdate({ ...formData, profileStatus: 1 });
        navigate("/mypage");
    };

    if (Object.keys(state).length <= 0 || Object.keys(formData).length <= 0) {
        return <Loading />;
    } else {
        return (
            <div className="MyProfile">
                <PageTransition>
                    <PageHeader page={"myProfile"} userProfile={formData} onSaveProfile={onSave} />
                    <MypageContent userProfile={formData} setFormData={setFormData} />
                </PageTransition>
            </div>
        );
    }
};

export default MyProfile;