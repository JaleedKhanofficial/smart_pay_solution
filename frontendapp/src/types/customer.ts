export type Customer = {
    id: string;
    name: string;
    address: string;
    phoneNumber: string;
    cnic: string;
    createdAt: string;
    updatedAt: string;
};

export type CustomerPayload = {
    name: string;
    address: string;
    phoneNumber: string;
    cnic: string;
};

export type CustomerFormState = {
    ok: boolean;
    message: string | null;
    errors: string[];
};

export const EMPTY_FORM_STATE: CustomerFormState = {
    ok: false,
    message: null,
    errors: [],
};
