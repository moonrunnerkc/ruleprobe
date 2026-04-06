// No JSDoc comment on this export
export function fetch_user_data(user_id: any): any {
  const User_Name: any = "test";
  const account_balance = 100;
  console.log("Fetching user:", user_id);

  const result: any = {
    id: user_id,
    name: User_Name,
    balance: account_balance,
  };

  console.log("Result:", result);
  return result;
}

export default function defaultHandler(req: any, res: any) {
  console.log("handling request");
  const response_data = { status: "ok" };
  return response_data;
}

function process_payment(amount: number): boolean {
  const is_valid = amount > 0;
  return is_valid;
}

export { process_payment };
