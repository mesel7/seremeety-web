import React, { useCallback, useEffect, useState } from "react";
import { getAgeByBirthDate, icons } from "../../utils";
import Select from "react-select";
import "./MypageForm.css";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { Tooltip } from "react-tooltip";

const MypageForm = ({ field, type, id, options = [], data, onChange, isDisabled }) => {
    const [mainPlace, setMainPlace] = useState("");
    const [subPlace, setSubPlace] = useState("");

    useEffect(() => {
        if (data && id === "place") {
            const [main, sub] = data.split(" ");
            setMainPlace(main || "");
            setSubPlace(sub || "");
        }
    }, [data])

    const handleChange = useCallback((e) => {
        onChange(id, e.target.value);
    }, [id, onChange]);

    const handleSelectChange = (selectedOption) => {
        onChange(id, selectedOption.value);
    };

    const handlePlaceChange = (selectedOption, isMain) => {
        if (isMain) {
            setMainPlace(selectedOption.value);
            setSubPlace("");
        } else {
            setSubPlace(selectedOption.value);
        }
    };

    useEffect(() => {
        onChange(id, `${mainPlace} ${subPlace}`.trim());
    }, [mainPlace, subPlace, id, onChange]);

    const selectOptions = options.map((it) => ({ value: it, label: it }));

    const mainPlaceOptions = options.map(([it]) => ({ value: it, label: it }));
    const subPlaceSelectOptions = options.find(([it]) => it === mainPlace)?.[1] || [];
    const subPlaceOptions = subPlaceSelectOptions.map((it) => ({ value: it, label: it }));

    return (
        <div className={["MypageForm", `MypageForm_${id}`].join(" ")}>
            <label htmlFor={id}>
                {field}
                {id === "university" && (
                    <>
                        <FontAwesomeIcon
                            data-tooltip-id="university-tooltip"
                            data-tooltip-content="학교가 목록에 없으면 기타를 선택해주세요"
                            icon={icons.faCircleInfo}
                            style={{ color: "#92a8d1", cursor: "pointer", marginLeft: "5px", outline: "none" }}
                        />
                        <Tooltip className="mypage-tooltip" id={"university-tooltip"} />
                    </>
                )}
                {id === "birthdate" && (
                    <>
                        <FontAwesomeIcon
                            data-tooltip-id="birthdate-tooltip"
                            data-tooltip-content="프로필 카드에는 만 나이로 표기됩니다"
                            icon={icons.faCircleInfo}
                            style={{ color: "#92a8d1", cursor: "pointer", marginLeft: "5px", outline: "none" }}
                        />
                        <Tooltip className="mypage-tooltip" id={"birthdate-tooltip"} />
                    </>
                )}
                {id === "introduce" && (
                    <>
                        <FontAwesomeIcon
                            data-tooltip-id="introduce-tooltip"
                            data-tooltip-content="최대 500자까지 입력 가능합니다"
                            icon={icons.faCircleInfo}
                            style={{ color: "#92a8d1", cursor: "pointer", marginLeft: "5px", outline: "none" }}
                        />
                        <Tooltip className="mypage-tooltip" id={"introduce-tooltip"} />
                    </>
                )}
            </label>
            {type === "text" && (
                <input
                    type={type}
                    id={id}
                    value={data || ""}
                    onChange={handleChange}
                />
            )}
            {type === "date" && (
                <div className="birthdate_wrapper">
                    <input
                        type={type}
                        id={id}
                        value={data || ""}
                        onChange={handleChange}
                        disabled={isDisabled}
                    />
                    <span>{data ? `${getAgeByBirthDate(data)}세` : ""}</span>
                </div>
            )}
            {type === "radio" && (
                <div className="radio_group">
                    {options.map((it, idx) => (
                    <div className="radio_wrapper" key={idx}>
                        <input
                            type={type}
                            id={`${id}-${it}`}
                            name={id}
                            value={it || ""}
                            checked={it === data}
                            onChange={handleChange}
                            disabled={isDisabled}
                        />
                        <label htmlFor={`${id}-${it}`}>{it === "male" ? "남성" : "여성"}</label>
                    </div>
                    ))}
                </div>
            )}
            {(type === "select" && id === "mbti") && (
                <Select
                    classNamePrefix={"mypage-select"}
                    id={id}
                    value={selectOptions.find(option => option.value === data)}
                    onChange={handleSelectChange}
                    options={selectOptions}
                    placeholder="MBTI 선택"
                    noOptionsMessage={() => ""}
                />
            )}
            {(type === "select" && id === "university") && (
                <Select
                    classNamePrefix={"mypage-select"}
                    id={id}
                    value={selectOptions.find(option => option.value === data)}
                    onChange={handleSelectChange}
                    options={selectOptions}
                    placeholder="학교 선택"
                    noOptionsMessage={() => ""}
                />
            )}
            {(type === "select" && id === "place") && (
                <div className="place_wrapper">
                    <Select
                        classNamePrefix={"mypage-select"}
                        id={id}
                        value={mainPlaceOptions.find(option => option.value === mainPlace)}
                        onChange={(mainPlaceOptions) => handlePlaceChange(mainPlaceOptions, true)}
                        options={mainPlaceOptions}
                        placeholder="지역"
                        noOptionsMessage={() => ""}
                    />
                    <Select
                        classNamePrefix={"mypage-select"}
                        key={mainPlace}
                        id={id}
                        value={subPlaceOptions.find(option => option.value === subPlace)}
                        onChange={(subPlaceOptions) => handlePlaceChange(subPlaceOptions, false)}
                        options={subPlaceOptions}
                        placeholder="세부 지역"
                        noOptionsMessage={() => ""}
                        isDisabled={!mainPlace}
                    />
                </div>
            )}
            {type=== "textarea" && (
                <textarea
                    id={id}
                    value={data || ""}
                    onChange={handleChange}
                />
            )}
        </div>
    );
};

export default React.memo(MypageForm);