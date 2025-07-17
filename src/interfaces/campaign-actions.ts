// Interface for sending campaign application
export interface SendApplicationRequest {
  campaignId: string;
  applicationMessage: string;
}

export interface SendApplicationResponse {
  success: boolean;
  message: string;
  data?: {
    applicationId: string;
    status: string;
  };
}

// Interface for accepting contract
export interface AcceptContractRequest {
  campaignId: string;
}

export interface AcceptContractResponse {
  success: boolean;
  message: string;
  data?: {
    contractId: string;
    campaignId: string;
    status: string;
    acceptedAt: string;
  };
}
