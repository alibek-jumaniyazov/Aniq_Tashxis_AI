"""Commerce API facade; receipt submission never proves or moves money.

Route groups retain the public API order, while shared clinic and team operations
live with their corresponding workflows. Existing function imports remain valid.
"""

from fastapi import APIRouter

from .billing_checkout import (
    account as account,
    public_methods as public_methods,
    public_plans as public_plans,
    receipt as receipt,
    register as register,
    router as _billing_checkout_router,
    submit_request as submit_request,
)

from .billing_developer import (
    developer_clinic as developer_clinic,
    developer_clinics as developer_clinics,
    developer_create_clinic as developer_create_clinic,
    developer_create_method as developer_create_method,
    developer_create_plan as developer_create_plan,
    developer_create_user as developer_create_user,
    developer_methods as developer_methods,
    developer_overview as developer_overview,
    developer_patch_clinic as developer_patch_clinic,
    developer_patch_method as developer_patch_method,
    developer_patch_plan as developer_patch_plan,
    developer_patch_user as developer_patch_user,
    developer_plans as developer_plans,
    developer_requests as developer_requests,
    developer_users as developer_users,
    page_query as page_query,
    review_request as review_request,
    router as _billing_developer_router,
    update_versioned as update_versioned,
)

from .billing_registration import (
    bootstrap as bootstrap,
    create_clinic as create_clinic,
    get_plan as get_plan,
)

from .billing_team import (
    add_user as add_user,
    change_user as change_user,
    create_team_user as create_team_user,
    patch_team_user as patch_team_user,
    router as _billing_team_router,
    team as team,
    team_json as team_json,
)

router = APIRouter(prefix="/api/v1")

# Keep the route groups in their original public API order.
router.include_router(_billing_checkout_router)
router.include_router(_billing_team_router)
router.include_router(_billing_developer_router)
