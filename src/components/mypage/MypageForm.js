import React, { useCallback } from "react";
import { getAgeByBirthDate } from "../../utils";
import "./MypageForm.css";

const MypageForm = ({ field, type, id, options, data, onChange, isDisabled }) => {
    const handleChange = useCallback((e) => {
        onChange(id, e.target.value);
    }, [id, onChange]);

    return (
        <div className={["MypageForm", `MypageForm_${id}`].join(" ")}>
            <label htmlFor={id}>{field}</label>
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
            {type === "select" && (
                <select id={id} value={data} onChange={handleChange}>
                    {options.map((it, idx) => <option key={idx} value={it || ""}>{it}</option>)}
                </select>
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