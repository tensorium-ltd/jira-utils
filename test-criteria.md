# Release 1D - Test Criteria Document

Generated: 2025-12-23

## Overview

This document details test criteria extracted from Release 1D Epics and User Stories, mapped to Functional Requirements (FRs) where available.

| Metric | Count |
|--------|------:|
| Total Epics | 10 |
| Total Stories | 175 |
| Stories with FR References | 106 |
| Stories with Acceptance Criteria | 92 |

---

## VER10-8570: Inflation - Library Set Up and WBS Changes

**Status:** In Validation | **Stories:** 13 | **Points:** 16
**FR References:** FR150, FR1490, FR870, FR880, FR890, FR90, FR930, FR601

### Epic Description

Epic Description:

This epic covers the foundational functionality required to solve the core challenge of inconsistent source data within an estimate. The primary goal is to establish a robust process where estimators work with live, un-normalized rates in the Work Breakdown Structure (WBS), with all complex rebasing calculations for both cost and carbon happening automatically at the point of reporting.

This approach, aligned with the V8 methodology, simplifies the estimator's workflow by deferring all normalization calculations. The epic will deliver the necessary admin configuration at the Cost Element level and the estimator's ability to set up their project. The final output of this epic is a reporting engine capable of generating a consistent, rebased baseline for any estimate.

Key Functionality to be Built:

• For System Admins:
• A central Inflation Index Library for managing all official indices.

• The ability to ensure all resources in the Resource Library have a single, common base date.


• For Estimators:
• The ability to set a project specific Common Base Date for Cost and Common Base Date for Carbon when creating an estimate.

• The ability to build an estimate in the WBS viewing the live, un-normalized rates at their various source dates.

• The ability to set high-level Project Start/End Dates and select a Scheme Type within the estimate

• The ability to view and manage the default cost element configuration for their estimate type.



Please see attached document “Scope 2 Inflation Profiles Final”  on Tab “Output“ for the indices required to be set up

Inflation Indices Required for Asset Renewals:

1. Scheme Delivery Framework Option C – Target Cost (SDF)

2. Scheme Delivery Framework Option E – Cost Reimbursable (SDF)

3. Pavement Delivery Framework – Bitumen (PDF)

4. Pavement Delivery Framework – Non-bitumen (PDF)

5. Concrete Roads Framework – Design (CRF)

6. Concrete Roads Framework – Life Extension Works – Staff (CRF)

7. Concrete Roads Framework – Life Extension Works – Construction (CRF)

8. Concrete Roads Framework – Reconstruction – Staff (CRF)

9. Concrete Roads Framework – Reconstruction – Construction (CRF)

10. Legacy Concrete Road Renewal – Option C (LCRR)

 

Inflation Indices Required for Operations and Maintenance (M&R):

11.Maintenance and Response (M&R)

 

Inflation Indices Required for Major Projects:

12.Regional Delivery Partnership (RDP)

13.CPMS


[Table content]

[Table content]

[Table content]

[Table content]

[Table content]

[Table content]

[Table content]

### VER10-8896: BE - Set Estimate Price Base Date (Cost) and Estimate Base Date (Carbon)

**Status:** Ready for release | **Points:** 1
**FR Trace:** FR150, FR1490, FR870, FR880, FR890, FR90, FR930

### VER10-9255: SA - Inflation - Library Set Up and WBS Changes

**Status:** Closed | **Points:** 3
**FR Trace:** FR150, FR1490, FR870, FR880, FR890, FR90, FR930

#### Description

SA document reference - VER10-8570: Inflation - Library Set Up and WBS Changes - V10 - Product - Confluence

#### Test Checklist

- [ ] VER10-8570: Inflation - Library Set Up and WBS Changes - V10 - Product - Confluence

### VER10-9261: BE - Inflation - List all inflation indices

**Status:** Ready for release | **Points:** 1
**FR Trace:** FR150, FR1490, FR870, FR880, FR890, FR90, FR930

### VER10-9262: BE - Inflation - Details of Inflation index

**Status:** Ready for release | **Points:** 1
**FR Trace:** FR150, FR1490, FR870, FR880, FR890, FR90, FR930

### VER10-9263: BE - Inflation - Create of Inflation index

**Status:** Ready for release | **Points:** 1
**FR Trace:** FR150, FR1490, FR870, FR880, FR890, FR90, FR930

### VER10-9264: BE - Inflation - Update of Inflation index

**Status:** Ready for release | **Points:** 1
**FR Trace:** FR150, FR1490, FR870, FR880, FR890, FR90, FR930

### VER10-9265: BE - Inflation - Delete of Inflation index

**Status:** Ready for release | **Points:** 1
**FR Trace:** FR150, FR1490, FR870, FR880, FR890, FR90, FR930

### VER10-9266: BE - Inflation - Import using spreadsheet

**Status:** Ready for release | **Points:** 2
**FR Trace:** FR150, FR1490, FR870, FR880, FR890, FR90, FR930

### VER10-9318: FE - Inflation - List all inflation indices

**Status:** Ready for release | **Points:** 1
**FR Trace:** FR150, FR1490, FR870, FR880, FR890, FR90, FR930

### VER10-9319: FE - Inflation - Details of Inflation index

**Status:** Ready for release | **Points:** 1
**FR Trace:** FR150, FR1490, FR870, FR880, FR890, FR90, FR930

### VER10-9320: FE - Inflation - Create/Update of Inflation index

**Status:** Ready for release | **Points:** 1
**FR Trace:** FR150, FR1490, FR870, FR880, FR890, FR90, FR930

### VER10-9321: FE - Inflation - Delete of Inflation index

**Status:** Ready for release | **Points:** 1
**FR Trace:** FR150, FR1490, FR870, FR880, FR890, FR90, FR930

### VER10-9322: FE - Inflation - Import using spreadsheet

**Status:** Ready for release | **Points:** 1
**FR Trace:** FR150, FR1490, FR870, FR880, FR890, FR90, FR930

---

## VER10-8768: Epic E-3.3: Template Library - CRUD operation

**Status:** Demo/ Walkthrough | **Stories:** 10 | **Points:** 27
**FR References:** FR820, FR830

### VER10-8488: Create Templates

**Status:** Ready for release | **Points:** 3
**FR Trace:** FR820, FR830

#### Description

User Story

As an Estimator/Admin (access to Estimate Add permission and Template Library Add permission) , I want to create templates (O&M, AR, Carbon) with structure, defaults, and rates so that users have standardized starting points.

Acceptance Criteria

[Table content]

### VER10-8489: Edit Templates

**Status:** Ready for release | **Points:** 2
**FR Trace:** FR820, FR830

#### Description

User Story

As an Admin/Estimator (with adequate permissions)I want to edit existing templates (structure, defaults, resources, cost codes, carbon data)So that templates remain accurate, up to date, and compliant with governance rules.

### Acceptance Criteria

[Table content]

### VER10-8504: Publish-only Enforcement

**Status:** Ready for release | **Points:** 3
**FR Trace:** FR820, FR830

#### Description

### User Story

As a Reviewer/Approver (with publish access)I want to publish a template so that only approved, compliant templates are selectable in UI and APIs.

### Acceptance Criteria

[Table content]

### VER10-8505: Edit Published Template

**Status:** Ready for release | **Points:** 5
**FR Trace:** FR820, FR830

#### Description

### User Story

As an Admin/Estimator (with Template Library Edit + Estimate Edit permissions)I want to edit an already published template by creating a new draft versionSo that I can make updates without altering the locked, published version, ensuring historical accuracy and controlled governance.

### Acceptance Criteria

[Table content]

### VER10-8506: Archiving the Template

**Status:** Ready for release | **Points:** 2
**FR Trace:** FR820, FR830

#### Description

### User Story

As an AdminI want to archive outdated templates without deleting themSo that they cannot be reused in new estimates but remain available for historical audit and reference.

### Acceptance Criteria

[Table content]

### VER10-8516: Create Templates - API

**Status:** Ready for release | **Points:** 2
**FR Trace:** FR820, FR830

#### Description

User Story

As an Estimator/Admin (access to Estimate Add permission and Template Library Add permission) , I want to create templates (O&M, AR, Carbon) with structure, defaults, and rates so that users have standardized starting points.

Acceptance Criteria

[Table content]

### VER10-8517: Edit Templates - API

**Status:** Ready for release | **Points:** 3
**FR Trace:** FR820, FR830

#### Description

User Story

As an Admin/Estimator (with adequate permissions)I want to edit existing templates (structure, defaults, resources, cost codes, carbon data)So that templates remain accurate, up to date, and compliant with governance rules.

### Acceptance Criteria

[Table content]

### VER10-8519: Publish-only Enforcement - API

**Status:** Ready for release | **Points:** 2
**FR Trace:** FR820, FR830

#### Description

### User Story

As a Reviewer/Approver (with publish access)I want to publish a template so that only approved, compliant templates are selectable in UI and APIs.

### Acceptance Criteria

[Table content]

### VER10-8520: Edit Published Template - API

**Status:** Ready for release | **Points:** 3
**FR Trace:** FR820, FR830

#### Description

### User Story

As an Admin/Estimator (with Template Library Edit + Estimate Edit permissions)I want to edit an already published template by creating a new draft versionSo that I can make updates without altering the locked, published version, ensuring historical accuracy and controlled governance.

### Acceptance Criteria

[Table content]

### VER10-8521: Archiving - API

**Status:** Ready for release | **Points:** 2
**FR Trace:** FR820, FR830

#### Description

### User Story

As an AdminI want to archive outdated templates without deleting themSo that they cannot be reused in new estimates but remain available for historical audit and reference.

### Acceptance Criteria

[Table content]

---

## VER10-8767: Epic E-3.3: Template Library - Admin, Roles Permission and Audit Trail

**Status:** Demo/ Walkthrough | **Stories:** 9 | **Points:** 17
**FR References:** None

### VER10-8384: Role based access for Template Library - API

**Status:** Ready for release | **Points:** -

#### Description

As a system administratorI want to configure access levels for Template Library (None, Read, Read+Edit, Read+Add+Edit, Read+Add+Edit+Delete)So that users only perform actions permitted by their role and unauthorised actions are denied.

Acceptance Criteria

[Table content]

### VER10-8486: Estimate Duplication Reset

**Status:** Ready for release | **Points:** 1

#### Description

User StoryAs an Estimator, I want certain fields cleared when duplicating from template so that Estimate metadata is unique.

Acceptance Criteria

[Table content]

### VER10-8513: Role-Based Access for Template Library

**Status:** Ready for release | **Points:** 3

#### Description

User Story

As a System Admin, I want to enforce role-based permissions (None, Read, Add, Edit, Delete) for Template Library so that only authorized users can perform actions.

Acceptance Criteria

[Table content]

### VER10-8514: Estimate Duplication Reset - API

**Status:** Ready for release | **Points:** 3

#### Description

User StoryAs an Estimator, I want certain fields cleared when duplicating from template so that Estimate metadata is unique.

Acceptance Criteria

[Table content]

### VER10-8662: Admin - Optional columns to display in Template Browser - API

**Status:** Ready for release | **Points:** 2

### VER10-8696: Admin - Optional columns to display in Template Browser

**Status:** Ready for release | **Points:** 2

#### Description

### User Story

As an Admin, I want to configure which columns are visible in the Template Library browser (list/grid view) so that users can view only the relevant fields when browsing templates, improving usability and performance.

### Acceptance Criteria

[Table content]

### VER10-8783: Template library permissions- add/edit

**Status:** Ready for release | **Points:** 2

#### Description

1. User should have Estimate Add and Template Library Add permissions to create templates.



1. User should have Estimate Edit permission and Template Library Edit permission to edit existing templates.

Actual- EdittemppermissionnotworkingRecording 2025-11-06 180912.mp4

#### Test Checklist

- [ ] EdittemppermissionnotworkingRecording 2025-11-06 180912.mp4
- [ ] User should have Estimate Add and Template Library Add permissions to create templates.
- [ ] User should have Estimate Edit permission and Template Library Edit permission to edit existing templates.

### VER10-8859: Role Based Access for Template Library Workflow

**Status:** Ready for release | **Points:** 2

#### Description

### User Story:

As a Reviewer/Approver, I want workflow permissions that allow me to Publish and Archive templates (from either the Template Library or the Template WBS), so only compliant templates are available for new estimates and outdated ones are removed from active use.

MoSCoW: Must Have

### Acceptance Criteria

[Table content]

### VER10-8997: Role Based Access for Template Library Workflow - API

**Status:** Ready for release | **Points:** 2

#### Description

### User Story:

As a Reviewer/Approver, I want workflow permissions that allow me to Publish and Archive templates (from either the Template Library or the Template WBS), so only compliant templates are available for new estimates and outdated ones are removed from active use.

MoSCoW: Must Have

### Acceptance Criteria

[Table content]

---

## VER10-8758: Epic E-3.3: Template Library - Create Estimate from Template

**Status:** Demo/ Walkthrough | **Stories:** 7 | **Points:** 14
**FR References:** FR2230, FR1340, FR820, FR830

### VER10-8508: Cost Alignment

**Status:** Ready for release | **Points:** 1
**FR Trace:** FR2230, FR1340

#### Description

### User Story


As an Estimator, I want templates to support both cost and carbon data so that I can prepare estimates that meet compliance and governance standards (e.g., NH O&M, AR, and  estimation).

### Acceptance Criteria

[Table content]

### VER10-8522: Decouple Derived Estimates - API

**Status:** Ready for release | **Points:** 1
**FR Trace:** FR820, FR830

#### Description

### User Story

As a SystemI want projects created from templates to remain independent from the template after creationSo that changes made to the template do not automatically alter existing derived estimates, preserving historical accuracy.

### Acceptance Criteria

[Table content]

### VER10-8523: Cost Alignment - API

**Status:** Ready for release | **Points:** 1
**FR Trace:** FR2230, FR1340

#### Description

### User Story

As an Estimator, I want templates to support both cost and carbon data so that I can prepare estimates that meet compliance and governance standards (e.g., NH O&M, AR, and Carbon estimation).

### Acceptance Criteria

[Table content]

### VER10-8663: Select Estimate Template while creating estimate ( No Parent Child link ) - API

**Status:** Ready for release | **Points:** 2
**FR Trace:** FR820, FR830

#### Description

### User Story:

As an Estimator, I want to select an approved (Published) estimate template when creating a new standalone estimate so that I can quickly generate a consistent estimate structure without establishing a parent-child relationship.

### Acceptance Criteria:

[Table content]

### VER10-8664: Select Estimate Template while creating estimate ( With Parent Child link ) - API

**Status:** Ready for release | **Points:** 3
**FR Trace:** FR820, FR830

#### Description

### User Story

As an Estimator, I want to select a Published estimate template while creating a new estimate under a Parent Project so that the new estimate inherits the parent’s context but uses a standardised structure from the selected template.

### Acceptance Criteria

[Table content]

### VER10-8697: Select Estimate Template while creating estimate ( No Parent Child link )

**Status:** Ready for release | **Points:** 3
**FR Trace:** FR820, FR830

### VER10-8759: Select Estimate Template while creating estimate ( With Parent Child link )

**Status:** Ready for release | **Points:** 3
**FR Trace:** FR820, FR830

#### Description

### User Story

As an Estimator, I want to select a Published estimate template while creating a new estimate under a Parent Project so that the new estimate inherits the parent’s context but uses a standardised structure from the selected template.

### Acceptance Criteria

[Table content]

---

## VER10-9271: Subcontractor/Supplier List Library

**Status:** In Dev | **Stories:** 4 | **Points:** 6
**FR References:** None

### Epic Description

NOTE: The following comments and screen shots are based on Benchmark Version 7.84.8721.1 and the V8 user guide

Benchmark can store details of your Subcontractors and Suppliers. Functionally, only those using the Subcontractor Manager feature in Benchmark must set up the Subcontractor/Supplier Library. If you do not use the Subcontractor Manager feature, you can use the Subcontractor/Supplier Library to store your Contractors contact details for reference purposes.

### Subcontractor/Supplier Library


1 - Export, Tools

1.1 - Export - Provides a list of export options specific to the subcontractor/supplier library:

• Export all subcontractors/suppliers

• Export all listed subcontractors/suppliers (when list filtered)

• Export selected subcontractor/suppliers

1.2 - Tools - Provides a repeat list of the options available in the toolbar and right-click menus.

2 - Tools, Search & Filtering Fields


2.1 - Add - Add a new subcon/supplier. A blank subcon/supplier will be created, and the user will enter the required data into the subcon/supplier details fields

2.2 - Edit - Enters edit mode and allows the user to change/update subcon/supplier details fields

2.3 - Duplicate - Duplicates the selected subcon/supplier, and enters edit mode so that the user can update the subcon/supplier details fields as required. Used when a new subcon/supplier is to be added that shares details with an existing subcon/supplier.

2.4 - Advanced Find - Opens the “Find subcon/supplier” window which provides a greater number of search fields


2.5 - ShowAll - Used when search/filters have been applied, to show all subcon/suppliers

2.6 - Delete - Deletes the selected subcon/supplier. A pop up will appear asking the user to confirm


2.7 - Close - Closes the subcon/supplier library

2.8 - “OK”/”Cancel” - Available when in edit mode.  “OK” confirms the subcon/supplier details entered, “Cancel” cancels the operation.

2.9 - Search/filtering fields - Allows the user to search for a subcon/supplier by company or contact, or filter the subcon/supplier list by type or category, and whether they are active or inactive.  Left-click “Find” to search (or return key)

3 - Subcontractor/Supplier Fields

[Table content]

4 - Subcontractor/supplier List

Displays a list of the subcontractor/suppliers in the library, displaying the following columns:

• Code

• Company

• Contact

• Phone

• Type

• Town

• State (cropped out in the screenshot above)

Code, Company, Type, Town, and State columns are sortable

### VER10-9310: View Supplier/Subcontractor List - API

**Status:** Ready for release | **Points:** 2

### VER10-9323: View Supplier/Subcontractor List - UI & Integration

**Status:** Ready for release | **Points:** 2

#### Description

User Story

As a User with appropriate permissions, I want to view the list of suppliers and subcontractors in a tabular format  
So that I can see all available contractors, their details, and select them for various operations.

MoSCoW: Must Have  
SRS Trace: N/A  
Notes: This is the main list view for the Supplier/Subcontractor Library that displays all records in a sortable, searchable table format with selection capabilities.

### Acceptance Criteria

[Table content]

### VER10-9325: Subcontractor/supplier type from user codes (Subcontractor Type) - API

**Status:** Ready for release | **Points:** 1

#### Description

this is to get the supplier type which will be use during save and edit the supplier

### VER10-9563: Change StateId Input To DropDown

**Status:** Ready for release | **Points:** 1

#### Description

### Requirement:

As a user,I want the Country field removed from the UI and the State field changed to a dropdown,so that only valid states can be selected when creating or editing a Supplier/Subcontractor.

The State dropdown will be populated using the API endpoint:api/v2/common/states/get

The API returns a list of states with an ID and description, where:

• description is displayed to the end user

• id is sent in the create/edit payload

### Acceptance Criteria:

### Country Field Removal

• Given the Supplier/Subcontractor create or edit panel is opened

• When the form is rendered

• Then the Country field is not visible in the UI

• And Country data is not included in the submission payload

### State Field Display

• Given the form is loaded

• When the State field is rendered

• Then the State field is displayed as a dropdown

• And free-text entry is not allowed

### State Dropdown Population

• Given the form is loaded

• When the application calls api/v2/common/states/get

• Then the dropdown is populated using the API response

• And each dropdown option displays the description value (e.g., NSW, VIC, ACT)

• And each option internally maps to its corresponding id

### State Selection & Payload Mapping

• Given a user selects a State from the dropdown

• When the Supplier/Subcontractor is created or updated

• Then the selected State’s id is passed in the request payload

• And the State description is not sent in the payload

### Edit Supplier/Subcontractor

• Given an existing Supplier/Subcontractor with a saved stateId

• When the edit screen is opened

• Then the State dropdown is pre-selected with the matching description for the saved stateId


Sample Response for the api/v2/common/states/get call:

{
  "message": "Success",
  "data": [
    {
      "id": 1,
      "description": "NSW"
    },
    {
      "id": 2,
      "description": "VIC"
    },
    {
      "id": 3,
      "description": "ACT"
    },
    {
      "id": 4,
      "description": "NT"
    },
    {
      "id": 5,
      "description": "QLD"
    },
    {
      "id": 6,
      "description": "SA"
    },
    {
      "id": 7,
      "description": "TAS"
    },
    {
      "id": 8,
      "description": "WA"
    }
  ],
  "metaData": {}
}

#### Test Checklist

- [ ] description is displayed to the end user
- [ ] id is sent in the create/edit payload
- [ ] Given the Supplier/Subcontractor create or edit panel is opened
- [ ] When the form is rendered
- [ ] Then the Country field is not visible in the UI
- [ ] And Country data is not included in the submission payload
- [ ] Given the form is loaded
- [ ] When the State field is rendered
- [ ] Then the State field is displayed as a dropdown
- [ ] And free-text entry is not allowed
- [ ] Given the form is loaded
- [ ] When the application calls api/v2/common/states/get
- [ ] Then the dropdown is populated using the API response
- [ ] And each dropdown option displays the description value (e.g., NSW, VIC, ACT)
- [ ] And each option internally maps to its corresponding id
- [ ] Given a user selects a State from the dropdown
- [ ] When the Supplier/Subcontractor is created or updated
- [ ] Then the selected State’s id is passed in the request payload
- [ ] And the State description is not sent in the payload
- [ ] Given an existing Supplier/Subcontractor with a saved stateId
- [ ] When the edit screen is opened
- [ ] Then the State dropdown is pre-selected with the matching description for the saved stateId

---

## VER10-8769: Epic E-3.3: Template Library - Create Template from Estimate

**Status:** Demo/ Walkthrough | **Stories:** 3 | **Points:** 9
**FR References:** None

### VER10-8503: Convert Existing Estimate to Template

**Status:** Ready for release | **Points:** 3

#### Description

User Story

As an Admin (with required permissions), I want to mark an existing estimate as a templateSo that I can reuse its structure and data as a governed template for future projects.

### Acceptance Criteria

[Table content]

### VER10-8518: Convert Existing Estimate to Template - API

**Status:** Ready for release | **Points:** 3

#### Description

User Story

As an Admin (with required permissions), I want to mark an existing estimate as a templateSo that I can reuse its structure and data as a governed template for future projects.

### Acceptance Criteria

[Table content]

### VER10-8666: Duplicate Estimate with Resources - API

**Status:** Ready for release | **Points:** 3

#### Description

Need to create a common service to duplicate estimate with resources

---

## VER10-9306: R1D DEFECTS ONLY

**Status:** Open | **Stories:** 3 | **Points:** 5
**FR References:** None

### Epic Description

Currently in QA - Planned deployment to UAT is scheduled for the

### VER10-9305: Team4: A pop-up should be displayed when a Resource is added manually or from the library to any Subitem that has been added multiple times. The added Resource should then be applied to all Subitem instances

**Status:** Ready for review | **Points:** 2

#### Description

Steps to Reproduce:

1. Login to Benchmark application

2. Navigate to Estimate  

3. Add same subitem in different sections/same section

4. 
5. Add Resource manually or drag and drop in one of the subitem

6. pop up should be displayed

Expected Result:

A pop-up should be displayed when a Resource is added manually or from the library to any Subitem that has been added multiple times. The added Resource should then be applied to all Subitem instances

#### Test Checklist

- [ ] Login to Benchmark application
- [ ] Navigate to Estimate
- [ ] Add same subitem in different sections/same section
- [ ] Add Resource manually or drag and drop in one of the subitem
- [ ] pop up should be displayed

### VER10-9542: Team4: Relink Resources in Estimate - UI

**Status:** Ready for release | **Points:** 1

#### Description

Scenario1:  For an unlinked Resource, if the Resource Code match an entry in the Resource Library, then when the Estimator relinks the resource, all fields—except Quantity, Text, Production Rate Group, Supplier, Cost Code, Factor, WBS, Crew size, Exclude Qty from Profit, Cartage—should be disabled and reset to the corresponding values from the Resource Library.



Scenario2: For an unlinked Resource, if the Resource Code matches an entry in the Resource Library, then when the Estimator attempts to relink the resource, the system should display the below pop-up message and prevent the Estimator from linking the resource. The resource should remain unlinked

### VER10-9612: FE - Custom field support for Template library

**Status:** Ready for release | **Points:** 2

---

## VER10-9490: Team 2 R1D Add on's

**Status:** In Dev | **Stories:** 3 | **Points:** 6
**FR References:** FR780, FR782

### VER10-8599: Estimator Configurable List - Reorder - BE

**Status:** Ready for release | **Points:** 3

### VER10-8674: Reorder - Estimator Configurable Custom Fields - UI

**Status:** Ready for review | **Points:** 1

#### Description

As an Estimator, I want to manage the list of options for designated dropdown custom fields so that I can maintain a relevant set of values for my estimates.

Acceptance Criteria:

• Given a custom field is configured as a "Select list" with the "List editable by estimator?" option enabled, then I am able to manage its values within the estimate.

• An entry point to manage these values is available,  i.e.  "Manage field values" button in the Custom Fields panel or a "CF Settings" option in a "Tools" menu.

• When I access the Custom Fields Settings Panel, then it displays a list of all custom fields that are estimator configurable/editable.

• When I select a field, then I can view its current list of values.

• I can perform the following actions on the value list:
• Reorder existing values

#### Test Checklist

- [ ] Given a custom field is configured as a "Select list" with the "List editable by estimator?" option enabled, then I am able to manage its values within the estimate.
- [ ] An entry point to manage these values is available,  i.e.  "Manage field values" button in the Custom Fields panel or a "CF Settings" option in a "Tools" menu.
- [ ] When I access the Custom Fields Settings Panel, then it displays a list of all custom fields that are estimator configurable/editable.
- [ ] When I select a field, then I can view its current list of values.
- [ ] I can perform the following actions on the value list:
- [ ] Reorder existing values

### VER10-9613: BE - Custom field support for Template library

**Status:** Ready for release | **Points:** 2

#### Description

Custom field support for Template Library - backend changes required to support already created Template library.

#### Test Checklist

- [ ] backend changes required to support already created Template library.

---

## VER10-9084: Template mapping configuration

**Status:** Demo/ Walkthrough | **Stories:** 2 | **Points:** 2
**FR References:** None

### VER10-9212: Estimate output template - Filter

**Status:** Ready for release | **Points:** 1

#### Description

Observation / Enhancement Suggestion:When an admin creates a new Output Type Template mapping, the “Estimate Template” dropdown should ideally be filtered based on the selected Lifecycle Stage.

Currently, all templates are displayed regardless of the lifecycle stage selected, which could lead to rare but possible mismatches — for example, an O&M lifecycle stage being mapped to an Asset Renewal template.

Recommendation:Implement a filter so that once a lifecycle stage (e.g., O&M, Asset Renewal, New Construction) is selected, only templates created under that lifecycle stage are available in the “Estimate Template” dropdown.

Benefit:This ensures data consistency and prevents invalid template–lifecycle combinations during Output Type setup.

### VER10-9213: Estimate output template - Filter - API

**Status:** Ready for release | **Points:** 1

#### Description

Observation / Enhancement Suggestion:When an admin creates a new Output Type Template mapping, the “Estimate Template” dropdown should ideally be filtered based on the selected Lifecycle Stage.

Currently, all templates are displayed regardless of the lifecycle stage selected, which could lead to rare but possible mismatches — for example, an O&M lifecycle stage being mapped to an Asset Renewal template.

Recommendation:Implement a filter so that once a lifecycle stage (e.g., O&M, Asset Renewal, New Construction) is selected, only templates created under that lifecycle stage are available in the “Estimate Template” dropdown.

Benefit:This ensures data consistency and prevents invalid template–lifecycle combinations during Output Type setup.

---

## VER10-9491: Team 3 R1D Add On's

**Status:** In Dev | **Stories:** 1 | **Points:** 2
**FR References:** FR110

### VER10-9557: BE -  Add Economic Output Description and Organisation to System Codes 

**Status:** Ready for release | **Points:** 2

#### Description

As a System Admin, I need a central screen to define the associated values for (by Estimate lifecycle stage i.e. Operations and Maint, Asset Renewal, Major projects etc)  Organisation, and Economic Output Description values in the systems codes library , so that the estimate's outputs are correctly aligned with the overall project lifecycle for consistent reporting and data analysis.

Acceptance Criteria

1. The System Admin can Create, Read, Update, and Delete (CRUD) items for Organisation, and Economic Output Description

2. Deletion Prevention (In Use): The system prevents a hard delete of these Code if they are currently mapped to a configuration table (e.g. Section to Stage Mapping) or actively referenced by a live estimate. A clear error message must be displayed. “Code name is in use and cannot be deleted”

3. Data Structure: Creating a new code item requires the Admin to input a unique Code/ Code Description.

4. Life Cycle Stage Filtering:  The Admin is able to view and configure the code list for Organisation, and Economic Output Description specifically for the selected Life Cycle


Mapping for Organisation and Economic Output description to be provided shortly

#### Test Checklist

- [ ] The System Admin can Create, Read, Update, and Delete (CRUD) items for Organisation, and Economic Output Description
- [ ] Deletion Prevention (In Use): The system prevents a hard delete of these Code if they are currently mapped to a configuration table (e.g. Section to Stage Mapping) or actively referenced by a live estimate. A clear error message must be displayed. “Code name is in use and cannot be deleted”
- [ ] Data Structure: Creating a new code item requires the Admin to input a unique Code/ Code Description.
- [ ] Life Cycle Stage Filtering:  The Admin is able to view and configure the code list for Organisation, and Economic Output Description specifically for the selected Life Cycle

---

## Stories Without Epic Parent (120)

### VER10-6786: Implement a caching mechanism within the browser to reduce redundant data fetches and improve user experience.

**Status:** Closed | **Points:** 3

### VER10-7528: UI - Default Asset Tag Allocation (from Item Libraries) - WBS

**Status:** Ready for release | **Points:** -
**FR Trace:** FR1170, FR782

#### Description

User Story

As an Estimator, when I add items into an estimate from an item library, I want these items to carry the default tags for Asset as set up in that item library, so that I can streamline the initial categorization of items.


Acceptance Criteria:

• Given an item in the Item library has a pre- assigned asset tag, when an estimator brings an (drags and drops) item from the library into an estimate, and a default tag is defined in that library for Asset the item should automatically carry over that default asset tag into the estimate.

• Given the asset tag has been auto populated in the WBS, When I hover over the tag, Then the UI displays the full hierarchical path, confirming its provenance from the Dimensions Library.

• The system should leverage available preconfigured dimension hierarchy data to facilitate this automatic tagging

• For Automated tagging, Asset tags will be applied at the lowest level that is available in the pre configured dimension hierarchy table/data as per the item library.

#### Test Checklist

- [ ] Given an item in the Item library has a pre- assigned asset tag, when an estimator brings an (drags and drops) item from the library into an estimate, and a default tag is defined in that library for Asset the item should automatically carry over that default asset tag into the estimate.
- [ ] Given the asset tag has been auto populated in the WBS, When I hover over the tag, Then the UI displays the full hierarchical path, confirming its provenance from the Dimensions Library.
- [ ] The system should leverage available preconfigured dimension hierarchy data to facilitate this automatic tagging
- [ ] For Automated tagging, Asset tags will be applied at the lowest level that is available in the pre configured dimension hierarchy table/data as per the item library.

### VER10-7529: BE - Mass Population of Tags - WBS

**Status:** Ready for release | **Points:** 4
**FR Trace:** FR1170, FR782

#### Description

User Story

As an Estimator, I want to mass populate tags for efficiency, so that I can streamline the tagging process for multiple items.

Description

• The system shall provide a "mass population" feature to streamline the tagging process.

• Users must be able to select a higher level element (e.g. a section, or cost element) to which a single supplier, asset or location tag can be applied.

• Users must be able to apply a specific tag to all items contained within the selected higher level element.

• The mass population functionality must include options to:
• Apply to all. If selected and a dimension tag has already been assigned to an item, this should overwrite all existing tags and populate blank tags. 

### Acceptance Criteria

1. Initiating the Mass Tagging Action

• Section level or parent level rows in the grid must have their own cells for taggable dimensions (i.e. Asset, Supplier, Location).

• When a user hovers over a tag cell on a section level row, an "Assign tag" button must appear.

• Clicking the "Assign tag" button must open the tag library panel, allowing the user to choose a tag to apply.

1. Applying Tags to Child Items

• When a user selects a tag from the menu and confirms the action, the system must apply that tag to the corresponding column/dimensions for all child items nested under that section or cost element.

• Given a tag has been inherited, Then I (as an estimator) should still be able to change or clear the tag within the WBS if necessary for a specific item.

• After the mass assignment is complete, the tag cell on the parent/section row must be updated to display the tag that was just applied to all its children.

1. Representing Mixed Tag States

• If the child items under a section have different tags within the same dimension (e.g. one item is tagged 'ABC' and another is 'XYZ'), the parent row's corresponding cell must display the status "Mixed".

• The "Mixed" status indicates to the user that the underlying items are not uniformly tagged, allowing for easy identification of inconsistencies.

• A mixed tag state also applies if 1 child item under a parent section or cost element is yet to be tagged and all other items under that section or cost element are tagged with the same tag. 

1. Representing tags at Section or Cost element level after changes to child items 

• If all child items under a section or cost element are individually updated to a tag (i.e. the same tag) that is different to the overall section or cost element tag, then the section or cost element tag must be automatically updated to reflect the tag assigned to its underlying items 

• The tag at section or cost element level must always be reflective of its underlying children where it is a “Mixed” state (i.e. its underlying children have different tags or the same tag but at least one item untagged) or 1 consistent tag

#### Test Checklist

- [ ] The system shall provide a "mass population" feature to streamline the tagging process.
- [ ] Users must be able to select a higher level element (e.g. a section, or cost element) to which a single supplier, asset or location tag can be applied.
- [ ] Users must be able to apply a specific tag to all items contained within the selected higher level element.
- [ ] The mass population functionality must include options to:
- [ ] Apply to all. If selected and a dimension tag has already been assigned to an item, this should overwrite all existing tags and populate blank tags.
- [ ] Section level or parent level rows in the grid must have their own cells for taggable dimensions (i.e. Asset, Supplier, Location).
- [ ] When a user hovers over a tag cell on a section level row, an "Assign tag" button must appear.
- [ ] Clicking the "Assign tag" button must open the tag library panel, allowing the user to choose a tag to apply.
- [ ] When a user selects a tag from the menu and confirms the action, the system must apply that tag to the corresponding column/dimensions for all child items nested under that section or cost element.
- [ ] Given a tag has been inherited, Then I (as an estimator) should still be able to change or clear the tag within the WBS if necessary for a specific item.
- [ ] After the mass assignment is complete, the tag cell on the parent/section row must be updated to display the tag that was just applied to all its children.
- [ ] If the child items under a section have different tags within the same dimension (e.g. one item is tagged 'ABC' and another is 'XYZ'), the parent row's corresponding cell must display the status "Mixed".
- [ ] The "Mixed" status indicates to the user that the underlying items are not uniformly tagged, allowing for easy identification of inconsistencies.
- [ ] A mixed tag state also applies if 1 child item under a parent section or cost element is yet to be tagged and all other items under that section or cost element are tagged with the same tag.
- [ ] If all child items under a section or cost element are individually updated to a tag (i.e. the same tag) that is different to the overall section or cost element tag, then the section or cost element tag must be automatically updated to reflect the tag assigned to its underlying items
- [ ] The tag at section or cost element level must always be reflective of its underlying children where it is a “Mixed” state (i.e. its underlying children have different tags or the same tag but at least one item untagged) or 1 consistent tag
- [ ] Initiating the Mass Tagging Action
- [ ] Applying Tags to Child Items
- [ ] Representing Mixed Tag States
- [ ] Representing tags at Section or Cost element level after changes to child items

### VER10-7530: Admin FE - Configure Dimension Hierarchy Levels

**Status:** Ready for release | **Points:** 2
**FR Trace:** FR1170, FR782

#### Description

User Story

As a System Administrator, I want to configure and manage dimension hierarchical structures, so that the system can support evolving categorization and reporting needs.

Description

• The system shall provide an administrative interface for configuring the titles of Level 1 through Level 5 for Asset, Location, and Supplier hierarchies.

• Any changes made to these level titles by the administrator must apply consistently across all existing estimates within the Solution. 

Acceptance Criteria

1. Library Navigation and Initial State

• When accessing the Dimension Library, the system must default to displaying the "Asset" dimension.

• An administrator must be able to switch between the available dimensions (Asset, Location, Supplier) using a dropdown menu.

• For a dimension that has no data, an "unpopulated state" screen must be displayed, prompting the user to either import data or add it manually.

1. Configuring Hierarchy Levels

• An administrator must be able to define the hierarchy for each dimension by adding and naming columns.

• A '+' icon next to the last column header must allow the administrator to add a new level to the hierarchy.

• The system must support a maximum of 5 hierarchical levels per dimension.

• Each hierarchy level (column) header must include an "Enable" toggle switch.

• The "Enable" toggle for a child column (e.g. 'Class') must be disabled and unavailable for use until its direct parent column (e.g. 'Category') contains at least one entry.

1. Disabling and Enabling Hierarchy Levels

• Each hierarchy level (column) header must include an "Enable" toggle switch.

• When an administrator clicks the toggle to disable a column, a warning modal must appear to confirm the action.

• Upon confirmation, the column will become disabled.

• Disabling a column does not delete the data within it or in subsequent columns; the data is retained but becomes inaccessible.

• The "Enable" toggle for a child column (e.g. 'Class') must be disabled if its direct parent column (e.g., 'Category') does not contain any entries.

#### Test Checklist

- [ ] The system shall provide an administrative interface for configuring the titles of Level 1 through Level 5 for Asset, Location, and Supplier hierarchies.
- [ ] Any changes made to these level titles by the administrator must apply consistently across all existing estimates within the Solution.
- [ ] When accessing the Dimension Library, the system must default to displaying the "Asset" dimension.
- [ ] An administrator must be able to switch between the available dimensions (Asset, Location, Supplier) using a dropdown menu.
- [ ] For a dimension that has no data, an "unpopulated state" screen must be displayed, prompting the user to either import data or add it manually.
- [ ] An administrator must be able to define the hierarchy for each dimension by adding and naming columns.
- [ ] A '+' icon next to the last column header must allow the administrator to add a new level to the hierarchy.
- [ ] The system must support a maximum of 5 hierarchical levels per dimension.
- [ ] Each hierarchy level (column) header must include an "Enable" toggle switch.
- [ ] The "Enable" toggle for a child column (e.g. 'Class') must be disabled and unavailable for use until its direct parent column (e.g. 'Category') contains at least one entry.
- [ ] Each hierarchy level (column) header must include an "Enable" toggle switch.
- [ ] When an administrator clicks the toggle to disable a column, a warning modal must appear to confirm the action.
- [ ] Upon confirmation, the column will become disabled.
- [ ] Disabling a column does not delete the data within it or in subsequent columns; the data is retained but becomes inaccessible.
- [ ] The "Enable" toggle for a child column (e.g. 'Class') must be disabled if its direct parent column (e.g., 'Category') does not contain any entries.
- [ ] Library Navigation and Initial State
- [ ] Configuring Hierarchy Levels
- [ ] Disabling and Enabling Hierarchy Levels

### VER10-7531: Admin- Manage Dimension Hierarchy Data -Manual Entry

**Status:** Ready for release | **Points:** 2
**FR Trace:** FR1170, FR782

#### Description

User Story

As a Data Administrator, I want an easy way to manage the specific data entries within each level of the Asset, Location, and Supplier hierarchies via an admin panel, so that I can maintain accurate and up-to-date lists of available tags for estimators.

Acceptance Criteria

1. Manually Managing Entries

• To add a new entry, the administrator clicks the '+' icon in the header of the desired column, which adds a new, editable text field at the top of that column's list.

• When an entry is successfully added, a confirmation message with an "Undo" option must appear.

• The new entry should be briefly highlighted for visibility.

• The list of entries must be sorted alphabetically after the addition is complete.

• To edit an entry, the administrator can click directly into its text field to make it editable.

• To delete an entry, the administrator can hover over the item to reveal a delete icon (trash can) and click it.

• Upon deletion, the entry is removed from the list.

• A confirmation message (i.e. "[Entry Name] deleted. Undo") must appear at the bottom of the screen.

• The count of child items displayed next to the parent entry must update to reflect the deletion.

• Selecting an entry in a parent column filters the list of entries in all subsequent child columns.

1. System Behavior and Validation

• If an administrator adds a new entry field but clicks away before entering any text, a new record must not be created.

• The system must enforce validation rules for code and description and display a clear error message if they are not met.

• If an entry's text is too long for the column width, it must be truncated. The user must be able to see the full text, for example, by clicking to expand or via a tooltip.

1. WBS Behaviour

• Once saved, Changes and new entries made to a dimension hierarchy data by the administrator must be immediately available for selection by estimators when applying tags within the WBS.

• Where a data entry for a dimension level has been deleted, this entry must no longer be available for selection by estimators when applying tags.

#### Test Checklist

- [ ] To add a new entry, the administrator clicks the '+' icon in the header of the desired column, which adds a new, editable text field at the top of that column's list.
- [ ] When an entry is successfully added, a confirmation message with an "Undo" option must appear.
- [ ] The new entry should be briefly highlighted for visibility.
- [ ] The list of entries must be sorted alphabetically after the addition is complete.
- [ ] To edit an entry, the administrator can click directly into its text field to make it editable.
- [ ] To delete an entry, the administrator can hover over the item to reveal a delete icon (trash can) and click it.
- [ ] Upon deletion, the entry is removed from the list.
- [ ] A confirmation message (i.e. "[Entry Name] deleted. Undo") must appear at the bottom of the screen.
- [ ] The count of child items displayed next to the parent entry must update to reflect the deletion.
- [ ] Selecting an entry in a parent column filters the list of entries in all subsequent child columns.
- [ ] If an administrator adds a new entry field but clicks away before entering any text, a new record must not be created.
- [ ] The system must enforce validation rules for code and description and display a clear error message if they are not met.
- [ ] If an entry's text is too long for the column width, it must be truncated. The user must be able to see the full text, for example, by clicking to expand or via a tooltip.
- [ ] Once saved, Changes and new entries made to a dimension hierarchy data by the administrator must be immediately available for selection by estimators when applying tags within the WBS.
- [ ] Where a data entry for a dimension level has been deleted, this entry must no longer be available for selection by estimators when applying tags.
- [ ] Manually Managing Entries
- [ ] System Behavior and Validation
- [ ] WBS Behaviour

### VER10-7561: Edit Sub Item Resource Quantities and Rates

**Status:** Ready for release | **Points:** 2

#### Description

User Story:As an Estimator,I want to edit quantities and rates of Sub Item resources,So that I can fine-tune estimates to match productivity and supplier variations.

[Table content]

Reference from Version8:

if Resource is Linked


If Resource is unlinked


After changes made

### VER10-7607: Subitem should not be deleted if any Subitem is in any Estimate and Item Library

**Status:** Ready for release | **Points:** 2

#### Description

Subitem should not be deleted if it is used in Estimate → Resource screen

### VER10-7927: Resource Library in Estimate - Header navigation

**Status:** Ready for release | **Points:** 2

### VER10-8059: Import - Resource Library Changes - UI Uplift

**Status:** Ready for release | **Points:** 3
**FR Trace:** FR110

### VER10-8333: Custom Fields used for Sorting and Filtering - BE

**Status:** Ready for release | **Points:** 3
**FR Trace:** FR780, FR782

#### Description

As an Admin, I want to designate specific custom fields as 'high-performing' so they can be optimized for sorting, searching, filtering and calculations, while adhering to system limits.

Description: The system will limit the number of "high-performing" (indexed) fields to 20 per and data type  (e.g. 20 for Project, where data type is “selectable list”)

Acceptance Criteria:

• Given I am creating or editing a custom field (either Project or Estimate level), then a new column of checkboxes appears in the "Level control" section.

• This new column of checkboxes is labeled: "Used for sorting and searching".

• A checkbox is displayed for each level in the hierarchy (e.g. Portfolio, Programme, Project).

• The system enforces a limit of 20 high performing fields per level and per data type. (e.g. 20 'Text' fields at the 'Project' level, 20 'List' fields at the 'Project' level, etc.).

• When an admin tries to check the box for a 21st  Custom field of a specific level/data type combination, then the action is blocked, and a message appears prompting the user to "unselect" an existing high-performing field of the same data type to proceed. Message can read “All your slots have been utilized free one slot of the same data type to use this custom field in optimised sorting, searching and filtering”

• Designating a field as high performing at a parent level does not automatically apply the same designation to child levels. This must be set explicitly for each level where it is required.

#### Test Checklist

- [ ] Given I am creating or editing a custom field (either Project or Estimate level), then a new column of checkboxes appears in the "Level control" section.
- [ ] This new column of checkboxes is labeled: "Used for sorting and searching".
- [ ] A checkbox is displayed for each level in the hierarchy (e.g. Portfolio, Programme, Project).
- [ ] The system enforces a limit of 20 high performing fields per level and per data type. (e.g. 20 'Text' fields at the 'Project' level, 20 'List' fields at the 'Project' level, etc.).
- [ ] When an admin tries to check the box for a 21st  Custom field of a specific level/data type combination, then the action is blocked, and a message appears prompting the user to "unselect" an existing high-performing field of the same data type to proceed. Message can read “All your slots have been utilized free one slot of the same data type to use this custom field in optimised sorting, searching and filtering”
- [ ] Designating a field as high performing at a parent level does not automatically apply the same designation to child levels. This must be set explicitly for each level where it is required.

### VER10-8334: Dashboard- Displaying and Locating Custom Fields in the UI - Project Details 

**Status:** Ready for release | **Points:** 3
**FR Trace:** FR780, FR782

#### Description

As an Estimator, I want to easily find and access custom fields in a consistent location so that I can view and enter data efficiently.

Acceptance Criteria:

• Given custom fields are configured for the project level then by default, they appear in a dedicated "Custom Fields" tab within that level's main view.

• If the Admin has checked the "Move to 'General' tab" option for a custom field, then that field will instead appear in a "Custom fields" section at the bottom of the "General" tab.

• The layout of fields within the "Custom Fields" tab or section should be a logical grid, and the panel should be scrollable if the number of fields exceeds the visible area.

• Validate that if “Mandatory on Create/ Edit “ is selected / set by Admin in custom field Admin set up,  the custom field must be checked for population and an error thrown if un-populated

• The UI should clearly indicate the data type required in the input box for clarity for the estimator

#### Test Checklist

- [ ] Given custom fields are configured for the project level then by default, they appear in a dedicated "Custom Fields" tab within that level's main view.
- [ ] If the Admin has checked the "Move to 'General' tab" option for a custom field, then that field will instead appear in a "Custom fields" section at the bottom of the "General" tab.
- [ ] The layout of fields within the "Custom Fields" tab or section should be a logical grid, and the panel should be scrollable if the number of fields exceeds the visible area.
- [ ] Validate that if “Mandatory on Create/ Edit “ is selected / set by Admin in custom field Admin set up,  the custom field must be checked for population and an error thrown if un-populated
- [ ] The UI should clearly indicate the data type required in the input box for clarity for the estimator

### VER10-8335: WBS - Validating Custom Field Data in the UI - Project Details

**Status:** Ready for release | **Points:** 2
**FR Trace:** FR780, FR782

#### Description

As a system user, I want my data entries to be validated against the field's required format in real-time, So that I can identify and correct errors immediately, ensuring the data I submit is accurate and complete.

Acceptance Criteria:

• Given I am entering data into an editable custom field, then the system must validate that the input matches the field's data type (e.g. Single-line Text, Multi-line Text, Selection (Dropdown), Date, and a combined Integer/Decimal type).
• When I enter data that does not match the required format (e.g. entering "abc" into an Integer field), then the field is highlighted with an error state, and an error message is displayed. Message: “Invalid value in Custom Field “insert name of custom field”. Please verify your input to continue”.

• User can select OK to exit the message and continue

• The user cannot save the page until the validation error is corrected.

• The UI should clearly indicate the date type required in the input box for clarity for the estimator

 

• Given I am viewing a custom field of Data Type “Single Line Text” that requires a validator as set up as system admin, then the system must validate that the data entered by the estimator is as per the defined validator for that custom field i.e. Apha numeric, numeric, alphabet or Email
• When I enter data that does not match the validator format (e.g. entering "number or text" into a custom field with email validator), then the field is highlighted with an error state, and an error message is displayed.

• Message: “Invalid value in Custom Field “insert name of custom field”. Please verify your input to continue”.

• User can select OK to exit the message and continue

• The user cannot save the page until the validation error is corrected.

• The UI should clearly indicate the date type required in the input box for clarity for the estimator

 

• Given the system admin has specified that a Custom field is Mandatory on Create/edit , then the system must validate that the custom field is populated by the estimator on creation of an Estimate.
• When I try to Create and save a new estimate without populating a custom field that has been set up as “Mandatory on Create/edit”, then the system must display a message

• Message: “Please complete mandatory field:  “insert name of custom field” to continue.

• Where more than 1 mandatory field is missing, the names are listed out, separated by a comma.

• User can select OK to exit the message and continue

• The user cannot save the page until the mandatory custom field has been populated

#### Test Checklist

- [ ] Given I am entering data into an editable custom field, then the system must validate that the input matches the field's data type (e.g. Single-line Text, Multi-line Text, Selection (Dropdown), Date, and a combined Integer/Decimal type).
- [ ] When I enter data that does not match the required format (e.g. entering "abc" into an Integer field), then the field is highlighted with an error state, and an error message is displayed. Message: “Invalid value in Custom Field “insert name of custom field”. Please verify your input to continue”.
- [ ] User can select OK to exit the message and continue
- [ ] The user cannot save the page until the validation error is corrected.
- [ ] The UI should clearly indicate the date type required in the input box for clarity for the estimator
- [ ] Given I am viewing a custom field of Data Type “Single Line Text” that requires a validator as set up as system admin, then the system must validate that the data entered by the estimator is as per the defined validator for that custom field i.e. Apha numeric, numeric, alphabet or Email
- [ ] When I enter data that does not match the validator format (e.g. entering "number or text" into a custom field with email validator), then the field is highlighted with an error state, and an error message is displayed.
- [ ] Message: “Invalid value in Custom Field “insert name of custom field”. Please verify your input to continue”.
- [ ] User can select OK to exit the message and continue
- [ ] The user cannot save the page until the validation error is corrected.
- [ ] The UI should clearly indicate the date type required in the input box for clarity for the estimator
- [ ] Given the system admin has specified that a Custom field is Mandatory on Create/edit , then the system must validate that the custom field is populated by the estimator on creation of an Estimate.
- [ ] When I try to Create and save a new estimate without populating a custom field that has been set up as “Mandatory on Create/edit”, then the system must display a message
- [ ] Message: “Please complete mandatory field:  “insert name of custom field” to continue.
- [ ] Where more than 1 mandatory field is missing, the names are listed out, separated by a comma.
- [ ] User can select OK to exit the message and continue
- [ ] The user cannot save the page until the mandatory custom field has been populated

### VER10-8336: Managing Values for Estimator Configurable Custom Fields

**Status:** Ready for release | **Points:** -
**FR Trace:** FR780, FR782

#### Description

As an Estimator, I want to manage the list of options for designated dropdown custom fields so that I can maintain a relevant set of values for my estimates.

Acceptance Criteria:

• Given a custom field is configured as a "Select list" with the "List editable by estimator?" option enabled, then I am able to manage its values within the estimate.

• An entry point to manage these values is available,  i.e.  "Manage field values" button in the Custom Fields panel or a "CF Settings" option in a "Tools" menu.

• When I access the Custom Fields Settings Panel, then it displays a list of all custom fields that are estimator configurable/editable.

• When I select a field, then I can view its current list of values.

• I can perform the following actions on the value list:
• Add new value(s). There is a dedicated data capture /entry field under the “add a value” button. 

• New Entries are committed by selecting “Save” beside the data capture field

• New Entries are added to the bottom of the populated list of values.

• “Update Values” commits the defined list and the list is immediately available in the WBS for selection

• Delete an existing value.
• If a deletion is attempted on an “In Use” Value, the user should be prompted with a message

• Header: Confirm Deletion. Message: This value is in use in the WBS and will be removed from all associated WBS items.  Do you want to proceed? Options: Yes, Delete, Cancel

• Edit an existing value. 
• If Edit is attempted on an “In use” value, the user should be prompted with a message 

• Header: Confirm Edit. Message: This value is in use in the WBS. The change will apply to all associated items. Do you want to proceed? Options: Yes, Update All, Cancel

• Filter/Search for a specific value.

• The estimator can define / add all applicable segments including an “All locations” and  “Mixed” 
• “Mixed” will be a required segment to ensure efficient and accurate reporting

• where multiple “segments” exist within a segment, “Mixed” will be shown as the Custom field at section level

• If only 1 segment exists at the section level, then that Segment reference/ name will be displayed as the Custom field at section level

• The Custom Field Settings panel only shows lists that are explicitly marked as "editable by estimator"; admin controlled lists are not included.

#### Test Checklist

- [ ] Given a custom field is configured as a "Select list" with the "List editable by estimator?" option enabled, then I am able to manage its values within the estimate.
- [ ] An entry point to manage these values is available,  i.e.  "Manage field values" button in the Custom Fields panel or a "CF Settings" option in a "Tools" menu.
- [ ] When I access the Custom Fields Settings Panel, then it displays a list of all custom fields that are estimator configurable/editable.
- [ ] When I select a field, then I can view its current list of values.
- [ ] I can perform the following actions on the value list:
- [ ] Add new value(s). There is a dedicated data capture /entry field under the “add a value” button.
- [ ] New Entries are committed by selecting “Save” beside the data capture field
- [ ] New Entries are added to the bottom of the populated list of values.
- [ ] “Update Values” commits the defined list and the list is immediately available in the WBS for selection
- [ ] Delete an existing value.
- [ ] If a deletion is attempted on an “In Use” Value, the user should be prompted with a message
- [ ] Header: Confirm Deletion. Message: This value is in use in the WBS and will be removed from all associated WBS items.  Do you want to proceed? Options: Yes, Delete, Cancel
- [ ] Edit an existing value.
- [ ] If Edit is attempted on an “In use” value, the user should be prompted with a message
- [ ] Header: Confirm Edit. Message: This value is in use in the WBS. The change will apply to all associated items. Do you want to proceed? Options: Yes, Update All, Cancel
- [ ] Filter/Search for a specific value.
- [ ] The estimator can define / add all applicable segments including an “All locations” and  “Mixed”
- [ ] “Mixed” will be a required segment to ensure efficient and accurate reporting
- [ ] where multiple “segments” exist within a segment, “Mixed” will be shown as the Custom field at section level
- [ ] If only 1 segment exists at the section level, then that Segment reference/ name will be displayed as the Custom field at section level
- [ ] The Custom Field Settings panel only shows lists that are explicitly marked as "editable by estimator"; admin controlled lists are not included.

### VER10-8374: UI - Assign Asset, Supplier and Location Tags - WBS

**Status:** Ready for release | **Points:** 2
**FR Trace:** FR1170, FR782

#### Description

As an Estimator, I want to select and assign Asset, Supplier, and Location tags to specific items in my estimate, so that I can accurately categorize, analyze, and report on costs and carbon across these different dimensions.

Acceptance Criteria

1. Accessing the Dimensions Panel

• When viewing the main estimate grid, a 'Tag' icon must be visible in the toolbar area.

• Clicking this 'Tag' icon must open a  right-hand panel titled 'Dimension Library'.

• The panel must remain open, overlaying the main content, until the user manually closes it.

1. Navigating and Searching Within the Panel

• Inside the 'Dimension Library' panel, the user must be able to 
• select a dimension type (e.g., Location, Supplier, Asset) from a dropdown menu or tabs.

• The panel must display a list of all available tags corresponding to the selected dimension.

• A filter/search bar must be present at the top of the tag list.

• When the user types into the filter bar, the tag list must instantly update to show only the tags that match the search term.

• The matching part of the text within the filtered tags should be highlighted.

• When a user hovers their mouse over a tag in the list, a tooltip must appear to show the full, untruncated name of the tag and the code.

1. Assigning Tags to Estimate Items

• The primary method for assigning a tag is for the item to be selected in the WBS and for the user to select the “assign tag” button from any of the dimensions (asset, supplier, location)

• The 'Dimension Library', is opened in the right hand pane users can select a dimension tag to be assigned to that item.
• The  dimension library is defaulted to that selected in the WBS. i.e if assign tag is selected from the supplier column in the WBS then the dimension library is defaulted to the supplier dimension library.

• User is not able to toggle between the dimensions

• Upon a successful assignment , the following must occur:
• The appropriate column (Asset, Supplier, or Location) for that line item must be updated with the assigned  tag's value. and a “tag updated successfully” message is briefly presented to the user

• A temporary confirmation message “tag updated successfully” must appear at the bottom of the screen.

• The 'Dimension Library' panel must remain open after a tag is assigned, allowing for multiple tags to be assigned without reopening

API DETAILS

1. Endpoint 1To List the Dimension TypeGET /api/v2/dimension-hierarchy/types

2. Endpoint 2To get the Dimension Data of selected TypeGET /api/v2/dimension-hierarchy/type/{hierarchyType}

3. Endpoint 3To Filter the Dimenstion Data of selected type based on search text GET /api/v2/dimension-hierarchy/{LOCATION|ASSET|SUPPLIER}?search={searchText}

4. Endpoint 4To Add/Update the Tags on the WBS Element POST /api/v2/estimate/{estimateId}/dimension-tagRequest Schema
[
  {
    "Id": 0,
    "EstimateNsetId": 0,
    "AssetHierarchyId": 0,
    "AssetHierarchyLevel": 0,
    "AssetHierarchyCode": "string",
    "AssetHierarchyDescription": "string",
    "SupplierHierarchyId": 0,
    "SupplierHierarchyLevel": 0,
    "SupplierHierarchyCode": "string",
    "SupplierHierarchyDescription": "string",
    "LocationHierarchyId": 0,
    "LocationHierarchyLevel": 0,
    "LocationHierarchyCode": "string",
    "LocationHierarchyDescription": "string"
  }
]
SWAGGER LINK

#### Test Checklist

- [ ] When viewing the main estimate grid, a 'Tag' icon must be visible in the toolbar area.
- [ ] Clicking this 'Tag' icon must open a  right-hand panel titled 'Dimension Library'.
- [ ] The panel must remain open, overlaying the main content, until the user manually closes it.
- [ ] Inside the 'Dimension Library' panel, the user must be able to
- [ ] select a dimension type (e.g., Location, Supplier, Asset) from a dropdown menu or tabs.
- [ ] The panel must display a list of all available tags corresponding to the selected dimension.
- [ ] A filter/search bar must be present at the top of the tag list.
- [ ] When the user types into the filter bar, the tag list must instantly update to show only the tags that match the search term.
- [ ] The matching part of the text within the filtered tags should be highlighted.
- [ ] When a user hovers their mouse over a tag in the list, a tooltip must appear to show the full, untruncated name of the tag and the code.
- [ ] The primary method for assigning a tag is for the item to be selected in the WBS and for the user to select the “assign tag” button from any of the dimensions (asset, supplier, location)
- [ ] The 'Dimension Library', is opened in the right hand pane users can select a dimension tag to be assigned to that item.
- [ ] The  dimension library is defaulted to that selected in the WBS. i.e if assign tag is selected from the supplier column in the WBS then the dimension library is defaulted to the supplier dimension library.
- [ ] User is not able to toggle between the dimensions
- [ ] Upon a successful assignment , the following must occur:
- [ ] The appropriate column (Asset, Supplier, or Location) for that line item must be updated with the assigned  tag's value. and a “tag updated successfully” message is briefly presented to the user
- [ ] A temporary confirmation message “tag updated successfully” must appear at the bottom of the screen.
- [ ] The 'Dimension Library' panel must remain open after a tag is assigned, allowing for multiple tags to be assigned without reopening
- [ ] Accessing the Dimensions Panel
- [ ] Navigating and Searching Within the Panel
- [ ] Assigning Tags to Estimate Items
- [ ] Endpoint 1To List the Dimension TypeGET /api/v2/dimension-hierarchy/types
- [ ] Endpoint 2To get the Dimension Data of selected TypeGET /api/v2/dimension-hierarchy/type/{hierarchyType}
- [ ] Endpoint 3To Filter the Dimenstion Data of selected type based on search text GET /api/v2/dimension-hierarchy/{LOCATION|ASSET|SUPPLIER}?search={searchText}
- [ ] Endpoint 4To Add/Update the Tags on the WBS Element POST /api/v2/estimate/{estimateId}/dimension-tagRequest Schema

### VER10-8375: UI - View & Manage Tags within the WBS

**Status:** Ready for release | **Points:** 2
**FR Trace:** FR1170, FR782

#### Description

As an Estimator, I want to efficiently view and manage (update) dimension tags within the WBS screen, so that I can quickly understand and refine item categorization.

Acceptance Criteria  (Managing tags in Grid in the WBS)

1. Accessing the Tag Management Menu

• When a user clicks on or hovers on an existing Asset, Supplier, or Location tag within a line item, a contextual menu ( small right-hand panel) should appear next to the clicked cell.

• This menu should show all available levels (tag hierarchy) for that specific tag including the code and associated description

1. Viewing and Selecting Tags

• The contextual menu must display a list of hieratical tag levels for that specific dimension (e.g. clicking a 'Location' tag shows all available levels for that location).

• The context menu should include an "Assign Tag" button and a “Remove tag” button

• If the user clicks on “Assign tag” the dimension library side panel is to be displayed 
• The user must be able to scroll through the list if the number of tags exceeds the visible area of the menu.

• A "Complete" button should be visible to confirm actions.

• If the user clicks on “delete tag”, the assigned tag and associated tag hierarchy for that dimension should be deleted
• The corresponding tag cell for that item in the main grid must be cleared.

• The system must save this change automatically.

1. Updating an Existing Tag

• When the user clicks on a different tag from the list within the menu, that new tag is selected as the replacement for the old one.

• Upon clicking the "Complete" button, the following must occur:
• The contextual menu must close.

• The line item in the main grid must be updated to display the newly selected tag.

• The system must save this change automatically.


Acceptance Criteria  (Managing tags in the Details Panel in the WBS)

• When viewing an item's details panel, assigned Asset, Supplier, and Location tags must be displayed.

• When a user hovers their mouse over an assigned tag, the context menu icon must become available.

• The context menu should include an "Assign Tag" button and a “Remove tag” button

• Upon clicking "Remove Tag", the following must occur:
• The tag must be unassigned from the item and removed from the details panel view.

• The corresponding tag cell for that item in the main grid must be cleared.

• The system must save this change automatically.


API DETAILS

1. ENDPOINT 1To Add/Update/Remove the tagPOST /api/v2/estimate/{estimateId}/dimension-tagRequest Send Single object, As on UI we dont have any multiselect change Tag functionality.
[{
  "estimateNsetId": 0,
  "locationHierarchyId": 0,
  "locationHierarchyLevel":0,
  "locHrchyCode": "string",
  "locHrchyDesc": "string",
  "assetHierarchyId": 0,
  "assetHierarchyLevel":0,
  "assetHrchyCode": "string",
  "assetHrchyDesc": "string",
  "supplierHierarchyId": 0,
  "supplierHierarchyLevel":0,
  "suppHrchyCode": "string",
  "suppHrchyDesc": "string"
},{...},...]

#### Test Checklist

- [ ] When a user clicks on or hovers on an existing Asset, Supplier, or Location tag within a line item, a contextual menu ( small right-hand panel) should appear next to the clicked cell.
- [ ] This menu should show all available levels (tag hierarchy) for that specific tag including the code and associated description
- [ ] The contextual menu must display a list of hieratical tag levels for that specific dimension (e.g. clicking a 'Location' tag shows all available levels for that location).
- [ ] The context menu should include an "Assign Tag" button and a “Remove tag” button
- [ ] If the user clicks on “Assign tag” the dimension library side panel is to be displayed
- [ ] The user must be able to scroll through the list if the number of tags exceeds the visible area of the menu.
- [ ] A "Complete" button should be visible to confirm actions.
- [ ] If the user clicks on “delete tag”, the assigned tag and associated tag hierarchy for that dimension should be deleted
- [ ] The corresponding tag cell for that item in the main grid must be cleared.
- [ ] The system must save this change automatically.
- [ ] When the user clicks on a different tag from the list within the menu, that new tag is selected as the replacement for the old one.
- [ ] Upon clicking the "Complete" button, the following must occur:
- [ ] The contextual menu must close.
- [ ] The line item in the main grid must be updated to display the newly selected tag.
- [ ] The system must save this change automatically.
- [ ] When viewing an item's details panel, assigned Asset, Supplier, and Location tags must be displayed.
- [ ] When a user hovers their mouse over an assigned tag, the context menu icon must become available.
- [ ] The context menu should include an "Assign Tag" button and a “Remove tag” button
- [ ] Upon clicking "Remove Tag", the following must occur:
- [ ] The tag must be unassigned from the item and removed from the details panel view.
- [ ] The corresponding tag cell for that item in the main grid must be cleared.
- [ ] The system must save this change automatically.
- [ ] Accessing the Tag Management Menu
- [ ] Viewing and Selecting Tags
- [ ] Updating an Existing Tag
- [ ] ENDPOINT 1To Add/Update/Remove the tagPOST /api/v2/estimate/{estimateId}/dimension-tagRequest Send Single object, As on UI we dont have any multiselect change Tag functionality.

### VER10-8378: Admin - Filter and Search for Dimension Hierarchy Data

**Status:** Ready for release | **Points:** 2
**FR Trace:** FR1170, FR782

#### Description

As a System Administrator, I want to search for specific entries across all levels of a dimension hierarchy, so that I can quickly locate and verify data within the Dimension Library.

Acceptance Criteria

1. Initiating and Performing a Search

• A search bar, identified by a magnifying glass icon, must be located in the top right corner of the Dimension Library toolbar 

• When an administrator starts typing a search term into the bar, the search must execute instantly and filter the data across all enabled hierarchy levels in real time 

1. Displaying Search Results

• The grid must update to show only the entries that contain the search term, across all columns 

• For each matching entry in a parent column, a number must be displayed to its right, indicating the total count of corresponding child items found in the next level of the hierarchy 

• If no child items are found for a particular result, no number should be displayed 

1. Navigating Filtered Results

• When an administrator clicks on a search result in one column (e.g. "North West" in the 'Region' column), the subsequent columns to the right must filter to show only the child entries that are directly associated with that selection 

• This allows the user to progressively drill down through the search results across the hierarchy.

1. Clearing the Search

• An 'x' icon must be present within the search bar whenever there is text entered 

• Clicking this 'x' icon must immediately clear the search term from the input field.

• Upon clearing the search, the grid must instantly revert to its default, unfiltered state, displaying all top level entries.

#### Test Checklist

- [ ] A search bar, identified by a magnifying glass icon, must be located in the top right corner of the Dimension Library toolbar
- [ ] When an administrator starts typing a search term into the bar, the search must execute instantly and filter the data across all enabled hierarchy levels in real time
- [ ] The grid must update to show only the entries that contain the search term, across all columns
- [ ] For each matching entry in a parent column, a number must be displayed to its right, indicating the total count of corresponding child items found in the next level of the hierarchy
- [ ] If no child items are found for a particular result, no number should be displayed
- [ ] When an administrator clicks on a search result in one column (e.g. "North West" in the 'Region' column), the subsequent columns to the right must filter to show only the child entries that are directly associated with that selection
- [ ] This allows the user to progressively drill down through the search results across the hierarchy.
- [ ] An 'x' icon must be present within the search bar whenever there is text entered
- [ ] Clicking this 'x' icon must immediately clear the search term from the input field.
- [ ] Upon clearing the search, the grid must instantly revert to its default, unfiltered state, displaying all top level entries.
- [ ] Initiating and Performing a Search
- [ ] Displaying Search Results
- [ ] Navigating Filtered Results
- [ ] Clearing the Search

### VER10-8400: Delete a Project Level Custom Field - BE

**Status:** Ready for release | **Points:** 2
**FR Trace:** FR780, FR782

#### Description

As an Admin, I want to edit an existing Project Level custom field to adjust its properties or when it is no longer needed.Acceptance Criteria Deleting:

• Given I am managing Project Level Custom fields, then a "Delete" option is available when hovering over a Custom field in the list, and a "Delete" button is visible on the edit form.

• When I initiate a deletion, a confirmation modal must appear.

• A field cannot be deleted if it is currently in use. An error modal ("This Custom Field is already being used...") must be shown in this case.

• If deletion is successful, the field is removed  from the list of Project Level custom fields including any configured parent levels (i.e. Portfolio and programme)

#### Test Checklist

- [ ] Given I am managing Project Level Custom fields, then a "Delete" option is available when hovering over a Custom field in the list, and a "Delete" button is visible on the edit form.
- [ ] When I initiate a deletion, a confirmation modal must appear.
- [ ] A field cannot be deleted if it is currently in use. An error modal ("This Custom Field is already being used...") must be shown in this case.
- [ ] If deletion is successful, the field is removed  from the list of Project Level custom fields including any configured parent levels (i.e. Portfolio and programme)

### VER10-8401: Delete a Project Level Custom Field - FE

**Status:** Ready for release | **Points:** 2
**FR Trace:** FR780, FR782

#### Description

As an Admin, I want to edit an existing Project Level custom field to adjust its properties or when it is no longer needed.Acceptance Criteria Deleting:

• Given I am managing Project Level Custom fields, then a "Delete" option is available when hovering over a Custom field in the list, and a "Delete" button is visible on the edit form.

• When I initiate a deletion, a confirmation modal must appear.

• A field cannot be deleted if it is currently in use. An error modal ("This Custom Field is already being used...") must be shown in this case.

• If deletion is successful, the field is removed from the list.

#### Test Checklist

- [ ] Given I am managing Project Level Custom fields, then a "Delete" option is available when hovering over a Custom field in the list, and a "Delete" button is visible on the edit form.
- [ ] When I initiate a deletion, a confirmation modal must appear.
- [ ] A field cannot be deleted if it is currently in use. An error modal ("This Custom Field is already being used...") must be shown in this case.
- [ ] If deletion is successful, the field is removed from the list.

### VER10-8408: Delete an Estimate level Custom Field - BE

**Status:** Ready for release | **Points:** 2
**FR Trace:** FR780, FR782

#### Description

Deleting Acceptance Criteria:

• Given I am managing Estimate Level fields, then a "Delete" option is available when hovering over a field in the list, and a "Delete" button is visible on the edit form.

• When I click to delete the field, a confirmation modal must appear asking for final confirmation.

• A field cannot be deleted if it is currently being used in any estimates. An error modal with the message "This Custom Field is already being used..." must be shown if a deletion is attempted.

• If the deletion is successful, the field is permanently removed from the list of Estimate Level custom fields including any configured child levels (i.e. section, composite item/item, resource)

#### Test Checklist

- [ ] Given I am managing Estimate Level fields, then a "Delete" option is available when hovering over a field in the list, and a "Delete" button is visible on the edit form.
- [ ] When I click to delete the field, a confirmation modal must appear asking for final confirmation.
- [ ] A field cannot be deleted if it is currently being used in any estimates. An error modal with the message "This Custom Field is already being used..." must be shown if a deletion is attempted.
- [ ] If the deletion is successful, the field is permanently removed from the list of Estimate Level custom fields including any configured child levels (i.e. section, composite item/item, resource)

### VER10-8409: Delete an Estimate level Custom Field - FE

**Status:** Ready for release | **Points:** 2
**FR Trace:** FR780, FR782

#### Description

Deleting Acceptance Criteria:

• Given I am managing Estimate Level fields, then a "Delete" option is available when hovering over a field in the list, and a "Delete" button is visible on the edit form.

• When I click to delete the field, a confirmation modal must appear asking for final confirmation.

• A field cannot be deleted if it is currently being used in any estimates. An error modal with the message "This Custom Field is already being used..." must be shown if a deletion is attempted.

• If the deletion is successful, the field is permanently removed from the list of Estimate Level custom fields.

#### Test Checklist

- [ ] Given I am managing Estimate Level fields, then a "Delete" option is available when hovering over a field in the list, and a "Delete" button is visible on the edit form.
- [ ] When I click to delete the field, a confirmation modal must appear asking for final confirmation.
- [ ] A field cannot be deleted if it is currently being used in any estimates. An error modal with the message "This Custom Field is already being used..." must be shown if a deletion is attempted.
- [ ] If the deletion is successful, the field is permanently removed from the list of Estimate Level custom fields.

### VER10-8429: Template Library - get all API

**Status:** Ready for release | **Points:** 3
**FR Trace:** FR820, FR830

#### Description

User Story

As a user, I can browse libraries of templates for O&M, AR, and Carbon with filters for type, status, lifecycle, and region.

Acceptance Criteria

[Table content]

### VER10-8462: Epic 9- Fallback Mech- Import Libraries- Team 1 Env 

**Status:** Ready for release | **Points:** 1
**FR Trace:** FR511

#### Description

Please load this libraries to Team 1 Env

### VER10-8463: Epic 9- Fallback Mech- Create tables in the DB for Carbon

**Status:** Ready for release | **Points:** 5
**FR Trace:** FR511

### VER10-8475: Epic 9- Fallback Mech- Identify the Resources missing Carbon value (backend)

**Status:** Ready for release | **Points:** 5
**FR Trace:** FR511

#### Description

As an estimator, I want the system to automatically allocate carbon values from the NH Carbon Emission library when I select the auto allocate button, so that missing values are flagged and excluded categories are handled correctly.

Scenario 01: Auto allocate carbon values from library

Given I am logged into the BES system as an estimatorAnd I have a list of resources in the estimation workspaceAnd some resources have associated carbon values stored in the NH Carbon Emission libraryAnd some resources do not have carbon values in the libraryAnd some resources are marked as "Zero-rated" or "Out of scope"

When I select the "Auto Allocate" button

Then the BES system shall map each resource to its carbon value from the NH Carbon Emission libraryAnd any resource without a matching carbon value in the library shall be identified as "Carbon value missing" in the backendAnd resources marked as "Zero-rated" shall be excluded from the resource mapping processAnd resources marked as "Out of scope" shall also be excluded from the resource mapping process.Carbon Libraries

### VER10-8484: Epic 9- Fallback Mech- Auto allocate carbon values from library

**Status:** Ready for release | **Points:** 3
**FR Trace:** FR511

#### Description

As an estimator, I want the system to automatically allocate carbon values from the NH Carbon Emission library when I select the auto allocate button, so that missing values are flagged and excluded categories are handled correctly.

Scenario 01: Auto allocate carbon values from library

Given I am logged into the BES system as an estimatorAnd I have a list of resources in the estimation workspaceAnd some resources have associated carbon values stored in the NH Carbon Emission libraryAnd some resource do not have a matching carbon value in the library

And system has identified as Missing carbon value When I select the "Auto Allocate" button

Then the BES system shall map each missing resource to C2C based on the following process - Find Resource category i.e. Labour, plant material. - Ffnd Rescource Carbon Category- Find Resource Classification using (Resource Category+ Resource category)- Pick Cost to carbon value for the Resource ClassificationAnd as the carbon value for the resource will he used to calculate the carbon value for the resource using (C2Cx £ of Resource= Carbon CO2e/£)

And the resource will be highlighted on the WBS screen with a marker as per the UI Scenario 02: BES suggests cost to carbon values

Given I am logged into the BES system as an estimatorAnd I have a list of resources in the estimation workspaceAnd I have selected the "Auto Allocate" 

And system has identfied some resources with missing carbon data

When I look at the resource with missing carbon data 

Then I will see the status ‘Cost to carbon’ as per the UI

And when I select the statust the following modal will appear as per the UI

### Cost to Carbon factor C2C number

Update Resource instances no of resources identified  as per us 8475And I will see ‘Apply’ and ‘Reject’ button And where I select else where on the screen modal will disappear

New columns to be addeed as part of  

• Rescource Carbon Category

• Resource Classification using (Resource Category+ Resource category)

• C2C- Cost to carbon value for the Resource Classification

Carbon Libraries

#### Test Checklist

- [ ] Find Resource category i.e. Labour, plant material. - Ffnd Rescource Carbon Category- Find Resource Classification using (Resource Category+ Resource category)- Pick Cost to carbon value for the Resource ClassificationAnd as the carbon value for the resource will he used to calculate the carbon value for the resource using (C2Cx £ of Resource= Carbon CO2e/£)
- [ ] Rescource Carbon Category
- [ ] Resource Classification using (Resource Category+ Resource category)
- [ ] C2C- Cost to carbon value for the Resource Classification

### VER10-8487: Template Library Browser

**Status:** Ready for release | **Points:** 5
**FR Trace:** FR820, FR830

#### Description

User Story

As a user, I can browse libraries of templates for O&M, AR, and Carbon with filters for type, status, lifecycle, and region.

Acceptance Criteria

[Table content]

### VER10-8491: Configure Estimate Numbering Syntax

**Status:** Ready for release | **Points:** 2

#### Description

User Story:As an admin, I want to configure estimate numbering using field-based syntax (chips like Programme, Region, Date), so that estimate numbers follow consistent patterns.

Acceptance Criteria:

[Table content]

### VER10-8493: Parent vs Child Estimate Numbering

**Status:** Ready for release | **Points:** 2

#### Description

User Story

As a user, I want parent estimates to have unique identifiers, and child estimates to either inherit reference from their parent or follow separate numbering rules, so that hierarchy is clear.

Acceptance Criteria

[Table content]

### VER10-8501: Epic 9- Fallback Mech- Identify the C2C fallback factors for the missing Carbon value (FrontEnd)

**Status:** Ready for release | **Points:** 5
**FR Trace:** FR511

#### Description

As an estimator, I want the system to automatically allocate carbon values from the NH Carbon Emission library when I select the auto allocate button, so that missing values are flagged and excluded categories are handled correctly.Scenario 01: Apply cost to carbon values as suggested by BES

Given I am logged into the BES system as an estimatorAnd I have a list of resources in the estimation workspaceAnd I have selected the "Auto Allocate" 

And system has identfied some resources with missing carbon data

When I look at the resource with missing carbon data 

Then I will see the status ‘Cost to carbon’ as per the UI

And when I select the statust the following modal will appear as per the UI

### Cost to Carbon factor C2C number

Update Resource instances no of resources identified  as per us 8475And I will see ‘Apply’ and ‘Reject’ button And where I select else where on the screen modal will disappear

Carbon Libraries

### VER10-8515: Template Library Browser - API

**Status:** Closed | **Points:** 3
**FR Trace:** FR820, FR830

#### Description

User Story

As a user, I can browse libraries of templates for O&M, AR, and Carbon with filters for type, status, lifecycle, and region.

Acceptance Criteria

[Table content]

### VER10-8532: Investigate Tanstack Virtualisation with Pagination for Item Library

**Status:** Ready for release | **Points:** 3

#### Description

As discussed, see if this can be implemented for Item Library specifically given the backend calculation issues: 

Move from load from button to infinite scrollOn filter change, reset the current page you are on

### VER10-8537: Audit Trail for Template Library - API

**Status:** In QA | **Points:** 3

#### Description

Acceptance Criteria – Audit Trail

[Table content]

### VER10-8559: Update Portfolio Description- R1A feeback

**Status:** Ready for release | **Points:** 2

#### Description

Scenario 01 - Portfolio Tile viewGiven I am an admin user

And I have selected the ‘Create Portfolio’ button

And I have provided the information in as 

Number : 51115

Description: O&M Area 7

and Comments : Free text

When I select to create the Portfolio 

Then a new portfolio will appear in the list 

And the portfolio ‘Description’ will be the title ‘O&M Area 7’And I will see NOT see the following details on tile

• Direct Cost 

• Indirect Cost

• Submission Price

• Margin


 And I will see the following details on tile

Portfolio RiskTotal KgCO2eProgrammes list (program under this portfoilo)

#### Test Checklist

- [ ] Portfolio Tile viewGiven I am an admin user
- [ ] Direct Cost
- [ ] Indirect Cost
- [ ] Submission Price

### VER10-8586: SA - WBS

**Status:** Closed | **Points:** -

#### Description

SA prepared for WBS screens - VER10-8473: Epic 11.2 - WBS - Implement Full Custom Fields Functionality - V10 - Product - Confluence

#### Test Checklist

- [ ] VER10-8473: Epic 11.2 - WBS - Implement Full Custom Fields Functionality - V10 - Product - Confluence

### VER10-8594: WBS - Estimator Configurable List - DB changes

**Status:** Closed | **Points:** 2
**FR Trace:** FR780, FR782

#### Description

CREATE TABLE v10_cf_estimate_codes (    cf_estimate_code_id   NUMBER PRIMARY KEY,    tenant_id       NUMBER,    estimate_id NUMBER NOT NULL ,    cf_definition_id NUMBER NOT NULL,    code VARCHAR2(100),    description VARCHAR2(4000),    "order" NUMBER,    created_on      TIMESTAMP,    created_by      NUMBER,    modified_on     TIMESTAMP,    modified_by     NUMBER,    hashcode        VARCHAR2(64),    is_deleted      NUMBER(1) DEFAULT 0);

### VER10-8595: WBS - Estimator Configurable List - Create - BE

**Status:** Ready for release | **Points:** 2
**FR Trace:** FR780, FR782

### VER10-8596: Estimator Configurable List - Update - BE

**Status:** Ready for release | **Points:** 2
**FR Trace:** FR780, FR782

### VER10-8597: Estimator Configurable List - Delete - BE

**Status:** Ready for release | **Points:** 3
**FR Trace:** FR780, FR782

### VER10-8598: Estimator Configurable List - GET - BE

**Status:** Ready for release | **Points:** 1
**FR Trace:** FR780, FR782

### VER10-8610: Custom Fields Set Up in Regression Env

**Status:** Ready for release | **Points:** 0.5

#### Description

This story covers the activity to set up the now ratified list of custom fields by National Highways in  regression environments.

The list of required custom fields is attached. They must be set up as they exist in the base application (set up parameters, naming etc must be set up as per V8).

### VER10-8619: WBS - Estimate Custom Fields - Create - BE

**Status:** Ready for release | **Points:** 2
**FR Trace:** FR780, FR782

### VER10-8620: WBS - Estimate Custom Fields - Update - BE

**Status:** Ready for release | **Points:** 2
**FR Trace:** FR780, FR782

### VER10-8621: WBS - Estimate Custom Fields - Get - BE

**Status:** Ready for release | **Points:** 3
**FR Trace:** FR780, FR782

### VER10-8622: WBS - Project Custom Fields - Create - BE

**Status:** Ready for release | **Points:** 2
**FR Trace:** FR780, FR782

### VER10-8623: WBS - Project Custom Fields - Update - BE

**Status:** Ready for release | **Points:** 2
**FR Trace:** FR780, FR782

### VER10-8624: WBS - Project Custom Fields - Get - BE

**Status:** Ready for release | **Points:** 3
**FR Trace:** FR780, FR782

### VER10-8640: Dashboard - Displaying and Locating Custom Fields in the UI - Estimate Details

**Status:** Ready for release | **Points:** 3
**FR Trace:** FR780, FR782

#### Description

As an Estimator, I want to easily find and access custom fields in a consistent location so that I can view and enter data efficiently.

Acceptance Criteria:

• Given custom fields are configured for a specific level (e.g. Project or Estimate), then by default, they appear in a dedicated "Custom Fields" tab within that level's main view.

• If the Admin has checked the "Move to 'General' tab" option for a custom field, then that field will instead appear in a "Custom fields" section at the bottom of the "General" tab.

• The layout of fields within the "Custom Fields" tab or section should be a logical grid, and the panel should be scrollable if the number of fields exceeds the visible area.

• This display logic applies consistently to both Project Level and Estimate Level custom fields.

• The UI should clearly indicate the data type required in the input box for clarity for the estimator

#### Test Checklist

- [ ] Given custom fields are configured for a specific level (e.g. Project or Estimate), then by default, they appear in a dedicated "Custom Fields" tab within that level's main view.
- [ ] If the Admin has checked the "Move to 'General' tab" option for a custom field, then that field will instead appear in a "Custom fields" section at the bottom of the "General" tab.
- [ ] The layout of fields within the "Custom Fields" tab or section should be a logical grid, and the panel should be scrollable if the number of fields exceeds the visible area.
- [ ] This display logic applies consistently to both Project Level and Estimate Level custom fields.
- [ ] The UI should clearly indicate the data type required in the input box for clarity for the estimator

### VER10-8641: Validating Custom Field Data in the UI - Estimate Details

**Status:** Ready for release | **Points:** 2
**FR Trace:** FR780, FR782

#### Description

As a system user, I want my data entries to be validated against the field's required format in real-time, So that I can identify and correct errors immediately, ensuring the data I submit is accurate and complete.

Acceptance Criteria:

• Given I am entering data into an editable custom field, then the system must validate that the input matches the field's data type (e.g. Single-line Text, Multi-line Text, Selection (Dropdown), Date, and a combined Integer/Decimal type).
• When I enter data that does not match the required format (e.g. entering "abc" into an Integer field), then the field is highlighted with an error state, and an error message is displayed. Message: “Invalid value in Custom Field “insert name of custom field”. Please verify your input to continue”.

• User can select OK to exit the message and continue

• The user cannot save the page until the validation error is corrected.

• The UI should clearly indicate the date type required in the input box for clarity for the estimator

 

• Given I am viewing a custom field of Data Type “Single Line Text” that requires a validator as set up as system admin, then the system must validate that the data entered by the estimator is as per the defined validator for that custom field i.e. Apha numeric, numeric, alphabet or Email
• When I enter data that does not match the validator format (e.g. entering "number or text" into a custom field with email validator), then the field is highlighted with an error state, and an error message is displayed.

• Message: “Invalid value in Custom Field “insert name of custom field”. Please verify your input to continue”.

• User can select OK to exit the message and continue

• The user cannot save the page until the validation error is corrected.

• The UI should clearly indicate the date type required in the input box for clarity for the estimator

 

• Given the system admin has specified that a Custom field is Mandatory on Create/edit , then the system must validate that the custom field is populated by the estimator on creation of an Estimate.
• When I try to Create and save a new estimate without populating a custom field that has been set up as “Mandatory on Create/edit”, then the system must display a message

• Message: “Please complete mandatory field:  “insert name of custom field” to continue.

• Where more than 1 mandatory field is missing, the names are listed out, separated by a comma.

• User can select OK to exit the message and continue

• The user cannot save the page until the mandatory custom field has been populated

 

• Given the system admin has specified that a Custom field is Mandatory on Completion , then the system must validate that the custom field is populated by the estimator before an Estimate can be classed as completed.
• When I try to complete an estimate without populating a custom field that has been set up as “Mandatory on Completion”, then the system must display a message “Please complete mandatory field:  “insert name of custom field” to continue.

• Where more than 1 mandatory field is missing, the names are listed out, separated by a comma.

• User can select OK to exit the message and continue

• The user cannot save/ complete the Estimate until the mandatory custom field has been populated

 

• Given the system admin has specified that a Custom field is Available in WBS , then the system must display that custom field in the WBS

#### Test Checklist

- [ ] Given I am entering data into an editable custom field, then the system must validate that the input matches the field's data type (e.g. Single-line Text, Multi-line Text, Selection (Dropdown), Date, and a combined Integer/Decimal type).
- [ ] When I enter data that does not match the required format (e.g. entering "abc" into an Integer field), then the field is highlighted with an error state, and an error message is displayed. Message: “Invalid value in Custom Field “insert name of custom field”. Please verify your input to continue”.
- [ ] User can select OK to exit the message and continue
- [ ] The user cannot save the page until the validation error is corrected.
- [ ] The UI should clearly indicate the date type required in the input box for clarity for the estimator
- [ ] Given I am viewing a custom field of Data Type “Single Line Text” that requires a validator as set up as system admin, then the system must validate that the data entered by the estimator is as per the defined validator for that custom field i.e. Apha numeric, numeric, alphabet or Email
- [ ] When I enter data that does not match the validator format (e.g. entering "number or text" into a custom field with email validator), then the field is highlighted with an error state, and an error message is displayed.
- [ ] Message: “Invalid value in Custom Field “insert name of custom field”. Please verify your input to continue”.
- [ ] User can select OK to exit the message and continue
- [ ] The user cannot save the page until the validation error is corrected.
- [ ] The UI should clearly indicate the date type required in the input box for clarity for the estimator
- [ ] Given the system admin has specified that a Custom field is Mandatory on Create/edit , then the system must validate that the custom field is populated by the estimator on creation of an Estimate.
- [ ] When I try to Create and save a new estimate without populating a custom field that has been set up as “Mandatory on Create/edit”, then the system must display a message
- [ ] Message: “Please complete mandatory field:  “insert name of custom field” to continue.
- [ ] Where more than 1 mandatory field is missing, the names are listed out, separated by a comma.
- [ ] User can select OK to exit the message and continue
- [ ] The user cannot save the page until the mandatory custom field has been populated
- [ ] Given the system admin has specified that a Custom field is Mandatory on Completion , then the system must validate that the custom field is populated by the estimator before an Estimate can be classed as completed.
- [ ] When I try to complete an estimate without populating a custom field that has been set up as “Mandatory on Completion”, then the system must display a message “Please complete mandatory field:  “insert name of custom field” to continue.
- [ ] Where more than 1 mandatory field is missing, the names are listed out, separated by a comma.
- [ ] User can select OK to exit the message and continue
- [ ] The user cannot save/ complete the Estimate until the mandatory custom field has been populated
- [ ] Given the system admin has specified that a Custom field is Available in WBS , then the system must display that custom field in the WBS

### VER10-8661: API standardization for error handling

**Status:** Ready for release | **Points:** 2

#### Description

Error handling -

### VER10-8671: Create - Estimator Configurable Custom Fields - UI

**Status:** Ready for release | **Points:** 3
**FR Trace:** FR780, FR782

#### Description

As an Estimator, I want to manage the list of options for designated dropdown custom fields so that I can maintain a relevant set of values for my estimates.

Acceptance Criteria:

• Given a custom field is configured as a "Select list" with the "List editable by estimator?" option enabled, then I am able to manage its values within the estimate.

• An entry point to manage these values is available,  i.e.  "Manage field values" button in the Custom Fields panel or a "CF Settings" option in a "Tools" menu.

• When I access the Custom Fields Settings Panel, then it displays a list of all custom fields that are estimator configurable/editable.

• When I select a field, then I can view its current list of values.

• I can perform the following actions on the value list:
• Add new value(s). There is a dedicated data capture /entry field under the “add a value” button. 

• New Entries are committed by selecting “Save” beside the data capture field

• New Entries are added to the bottom of the populated list of values.

• “Save” commits  all values of the defined list to the database and the list is immediately available in the WBS for selection

• “Cancel” prevents any changes to the list (edits, deletion or new entries) from being added to the database. A message should be displayed to the user. 
• Message  “You have unsaved changes. All unsaved changes to the custom field values will be lost. Do you want to proceed ” Options: Ok, Cancel

• Delete an existing value.
• If a deletion is attempted on an “In Use” Value, the user should be prompted with a message

• Message: “Saving these changes will impact the current estimate using the edited or deleted values. Do you wish to continue and apply the changes? Do you want to proceed? Options: Ok, Cancel

• Edit an existing value. 
• If Edit is attempted on an “In use” value, the user should be prompted with a message 

• Message: “Saving these changes will impact the current estimate using the edited or deleted values. Do you wish to continue and apply the changes? Do you want to proceed? Options: Ok, Cancel

• Filter/Search for a specific value.

• The estimator can define / add all applicable segments including an “All locations” and  “Mixed” 
• “Mixed” will be a required segment to ensure efficient and accurate reporting

• where multiple “segments” exist within a segment, “Mixed” will be shown as the Custom field at section level

• If only 1 segment exists at the section level, then that Segment reference/ name will be displayed as the Custom field at section level

• The Custom Field Settings panel only shows lists that are explicitly marked as "editable by estimator"; admin controlled lists are not included.

• On Navigation away from the current Custom Field being worked on, a message should be displayed to the user. 
• Message  “You have unsaved changes. All unsaved changes to the custom field values will be lost. Do you want to proceed ” Options: Ok, Cancel

#### Test Checklist

- [ ] Given a custom field is configured as a "Select list" with the "List editable by estimator?" option enabled, then I am able to manage its values within the estimate.
- [ ] An entry point to manage these values is available,  i.e.  "Manage field values" button in the Custom Fields panel or a "CF Settings" option in a "Tools" menu.
- [ ] When I access the Custom Fields Settings Panel, then it displays a list of all custom fields that are estimator configurable/editable.
- [ ] When I select a field, then I can view its current list of values.
- [ ] I can perform the following actions on the value list:
- [ ] Add new value(s). There is a dedicated data capture /entry field under the “add a value” button.
- [ ] New Entries are committed by selecting “Save” beside the data capture field
- [ ] New Entries are added to the bottom of the populated list of values.
- [ ] “Save” commits  all values of the defined list to the database and the list is immediately available in the WBS for selection
- [ ] “Cancel” prevents any changes to the list (edits, deletion or new entries) from being added to the database. A message should be displayed to the user.
- [ ] Message  “You have unsaved changes. All unsaved changes to the custom field values will be lost. Do you want to proceed ” Options: Ok, Cancel
- [ ] Delete an existing value.
- [ ] If a deletion is attempted on an “In Use” Value, the user should be prompted with a message
- [ ] Message: “Saving these changes will impact the current estimate using the edited or deleted values. Do you wish to continue and apply the changes? Do you want to proceed? Options: Ok, Cancel
- [ ] Edit an existing value.
- [ ] If Edit is attempted on an “In use” value, the user should be prompted with a message
- [ ] Message: “Saving these changes will impact the current estimate using the edited or deleted values. Do you wish to continue and apply the changes? Do you want to proceed? Options: Ok, Cancel
- [ ] Filter/Search for a specific value.
- [ ] The estimator can define / add all applicable segments including an “All locations” and  “Mixed”
- [ ] “Mixed” will be a required segment to ensure efficient and accurate reporting
- [ ] where multiple “segments” exist within a segment, “Mixed” will be shown as the Custom field at section level
- [ ] If only 1 segment exists at the section level, then that Segment reference/ name will be displayed as the Custom field at section level
- [ ] The Custom Field Settings panel only shows lists that are explicitly marked as "editable by estimator"; admin controlled lists are not included.
- [ ] On Navigation away from the current Custom Field being worked on, a message should be displayed to the user.
- [ ] Message  “You have unsaved changes. All unsaved changes to the custom field values will be lost. Do you want to proceed ” Options: Ok, Cancel

### VER10-8672: Update - Estimator Configurable Custom Fields - UI

**Status:** Ready for release | **Points:** 2
**FR Trace:** FR780, FR782

#### Description

As an Estimator, I want to manage the list of options for designated dropdown custom fields so that I can maintain a relevant set of values for my estimates.

Acceptance Criteria:

• Given a custom field is configured as a "Select list" with the "List editable by estimator?" option enabled, then I am able to manage its values within the estimate.

• When I select a field, then I can view its current list of values.

• I can perform the following actions on the value list:
Edit an existing value. 
• If Edit is attempted on an “In use” value, the user should be prompted with a message 

• Message: “Saving these changes will impact the current estimate using the edited or deleted values. Do you wish to continue and apply the changes? Do you want to proceed? Options: Ok, Cancel

#### Test Checklist

- [ ] Given a custom field is configured as a "Select list" with the "List editable by estimator?" option enabled, then I am able to manage its values within the estimate.
- [ ] When I select a field, then I can view its current list of values.
- [ ] I can perform the following actions on the value list:
- [ ] If Edit is attempted on an “In use” value, the user should be prompted with a message
- [ ] Message: “Saving these changes will impact the current estimate using the edited or deleted values. Do you wish to continue and apply the changes? Do you want to proceed? Options: Ok, Cancel

### VER10-8673: Delete - Estimator Configurable Custom Fields - UI

**Status:** Ready for release | **Points:** 1
**FR Trace:** FR780, FR782

#### Description

As an Estimator, I want to manage the list of options for designated dropdown custom fields so that I can maintain a relevant set of values for my estimates.

Acceptance Criteria:

• Given a custom field is configured as a "Select list" with the "List editable by estimator?" option enabled, then I am able to manage its values within the estimate.

• An entry point to manage these values is available,  i.e.  "Manage field values" button in the Custom Fields panel or a "CF Settings" option in a "Tools" menu.

• When I access the Custom Fields Settings Panel, then it displays a list of all custom fields that are estimator configurable/editable.

• When I select a field, then I can view its current list of values.

• I can perform the following actions on the value list:
Delete an existing value.
• If a deletion is attempted on an “In Use” Value, the user should be prompted with a message

• Message: “Saving these changes will impact the current estimate using the edited or deleted values. Do you wish to continue and apply the changes? Do you want to proceed? Options: Ok, Cancel

#### Test Checklist

- [ ] Given a custom field is configured as a "Select list" with the "List editable by estimator?" option enabled, then I am able to manage its values within the estimate.
- [ ] An entry point to manage these values is available,  i.e.  "Manage field values" button in the Custom Fields panel or a "CF Settings" option in a "Tools" menu.
- [ ] When I access the Custom Fields Settings Panel, then it displays a list of all custom fields that are estimator configurable/editable.
- [ ] When I select a field, then I can view its current list of values.
- [ ] I can perform the following actions on the value list:
- [ ] If a deletion is attempted on an “In Use” Value, the user should be prompted with a message
- [ ] Message: “Saving these changes will impact the current estimate using the edited or deleted values. Do you wish to continue and apply the changes? Do you want to proceed? Options: Ok, Cancel

### VER10-8675: GET - List of Estimator Configurable Fields - BE

**Status:** Ready for release | **Points:** 1
**FR Trace:** FR780, FR782

#### Description

For a given Estimate/Section/Item/Resource, List of all Custom fields which are marked as “Editable by Estimator“

### VER10-8691: Global API standardization for error handling - UI

**Status:** Closed | **Points:** 2

#### Description

Error handling -

### VER10-8702: UI - (Admin) Manual assignment of Tags in the Item Library

**Status:** Ready for release | **Points:** 2
**FR Trace:** FR1170, FR782

#### Description

User Story

As a System Admin, I want to manually assign an asset tag to an individual item using the Item Library UI, So that I can ensure each item is correctly classified according to its asset hierarchy before it is used in an estimate.

Acceptance Criteria

• Given I am viewing the list of items within an Item Library, When I select an item to tag, Then a UI element (e.g. a right side panel or modal) should appear, allowing me to select a tag from the Asset Dimension Library.

• Given the tagging UI is open, When I browse the asset dimension hierarchies, Then I can only select a tag from the lowest (most granular) level of any given hierarchy. Intermediate levels must not be selectable.

• Given I have selected a valid lowest level tag, When I save the change, Then the system stores the unique ID of that hierarchy record against the item in the database.

• Given an item has been tagged, When I view it in the Item Library list, Then a new "Asset Tag" column should display the full path of the assigned tag (e.g. "Ancillary > Non-Motorised User > Footway").

• Given I hover my mouse over the tag in the list view, Then a tooltip should appear showing the full hierarchical path, consistent with the behavior in the WBS.


Right hand panel same as exists in the WBS will be presented to enable tagging in the library

#### Test Checklist

- [ ] Given I am viewing the list of items within an Item Library, When I select an item to tag, Then a UI element (e.g. a right side panel or modal) should appear, allowing me to select a tag from the Asset Dimension Library.
- [ ] Given the tagging UI is open, When I browse the asset dimension hierarchies, Then I can only select a tag from the lowest (most granular) level of any given hierarchy. Intermediate levels must not be selectable.
- [ ] Given I have selected a valid lowest level tag, When I save the change, Then the system stores the unique ID of that hierarchy record against the item in the database.
- [ ] Given an item has been tagged, When I view it in the Item Library list, Then a new "Asset Tag" column should display the full path of the assigned tag (e.g. "Ancillary > Non-Motorised User > Footway").
- [ ] Given I hover my mouse over the tag in the list view, Then a tooltip should appear showing the full hierarchical path, consistent with the behavior in the WBS.

### VER10-8703: UI - (Admin) Bulk Tagging of Items in an Item Library via Spreadsheet Import

**Status:** Ready for release | **Points:** 2
**FR Trace:** FR1170, FR782

#### Description

User Story

As an Admin, I want to assign or update asset tags for multiple items at once by importing a data file, So that I can efficiently manage the entire library without having to tag each item manually.

Acceptance Criteria:

• Given I am an Admin, When I navigate to  the Item Library, Then there is an option for me to import / upload spreadsheet into the item library

• Given I have prepared a data file with item codes and their corresponding asset tag IDs, When I upload the file, Then the system must validate that each Asset Tag ID  exists in the Dimensions Library and corresponds to a lowest level hierarchy record.

• Given the import file contains rows with invalid or non-existent Asset Tag ID’s , When the import process runs, Then the system should reject those specific rows and provide a downloadable error report detailing which rows failed and why (e.g. "ID not found," "Tag is not at the lowest level as per the dimension library").

• Given the import file is processed successfully, When I view the updated items in the Item Library, Then their "Asset Tag" column correctly reflects the newly assigned tags and this also reflects the data held in the Asset dimension library.

#### Test Checklist

- [ ] Given I am an Admin, When I navigate to  the Item Library, Then there is an option for me to import / upload spreadsheet into the item library
- [ ] Given I have prepared a data file with item codes and their corresponding asset tag IDs, When I upload the file, Then the system must validate that each Asset Tag ID  exists in the Dimensions Library and corresponds to a lowest level hierarchy record.
- [ ] Given the import file contains rows with invalid or non-existent Asset Tag ID’s , When the import process runs, Then the system should reject those specific rows and provide a downloadable error report detailing which rows failed and why (e.g. "ID not found," "Tag is not at the lowest level as per the dimension library").
- [ ] Given the import file is processed successfully, When I view the updated items in the Item Library, Then their "Asset Tag" column correctly reflects the newly assigned tags and this also reflects the data held in the Asset dimension library.

### VER10-8705: UI - (Admin) Warning on Dimension Hierarchy Modification

**Status:** Ready for release | **Points:** 1
**FR Trace:** FR1170, FR782

#### Description

User Story

As a System Admin, When I attempt to edit a Dimension hierarchy level in the Dimensions Library (i.e. Asset)that is already linked to one or more items, I want to be presented with a clear warning message about the potential impact on existing data, allowing me to make an informed decision.


Acceptance Criteria

• Given the Dimension hierarchy data for a Level (i.e. Asset) is tagged to at least one item in an Item Library, When an Admin tries to add a new, more granular level to that hierarchy in the Dimensions Library, Then a confirmation modal/warning must appear.

• The warning message should state: "This hierarchy structure is currently assigned to existing items. Modifying it may lead to reporting inconsistencies. Please review all associated item tags after making this change to ensure they are still correct." changes made to the dimension library will be reflected in the item library

• Given the warning is displayed, Then the Admin must explicitly confirm they wish to proceed before the change is saved. 
• The options Cancel (to discard the changes) or Ok (to accept the changes) are available for selection

#### Test Checklist

- [ ] Given the Dimension hierarchy data for a Level (i.e. Asset) is tagged to at least one item in an Item Library, When an Admin tries to add a new, more granular level to that hierarchy in the Dimensions Library, Then a confirmation modal/warning must appear.
- [ ] The warning message should state: "This hierarchy structure is currently assigned to existing items. Modifying it may lead to reporting inconsistencies. Please review all associated item tags after making this change to ensure they are still correct." changes made to the dimension library will be reflected in the item library
- [ ] Given the warning is displayed, Then the Admin must explicitly confirm they wish to proceed before the change is saved.
- [ ] The options Cancel (to discard the changes) or Ok (to accept the changes) are available for selection

### VER10-8706: UI - (Expected System Behaviours) -  Prevent Deletion of an “In-Use” Tag

**Status:** Ready for release | **Points:** 1
**FR Trace:** FR1170, FR782

#### Description

###  Scenario - Prevent Deletion of an “In-Use” Tag (In the item Library)

As a System  Admin, I want the system to prevent me from deleting a hierarchy/level from the Dimensions Library if it is currently assigned to any item in the item library, So that data integrity is maintained across all Item Libraries and I do not accidentally create orphaned records.

*Please note that deletion is only prevented for “Enabled” Hierarchy levels. If a Hierarchy level is “Disabled” the system will NOT prevent the deletion of a tag from the dimension library

Acceptance Criteria:

• Given a hierarchy record in the Dimensions Library is assigned to one or more items on the item library, When I attempt to delete that specific hierarchy record, Then the system must block the deletion action.

• Given the deletion is blocked, Then the system must display a clear and informative error message explaining why the action failed (e.g., "This tag cannot be deleted because it is currently in use by one or more library items.").


###  Scenario - Prevent Deletion of an “In-Use” Tag (in the WBS)

As a System  Admin, I want the system to prevent me from deleting a dimension tag that is in use in any WBS, So that the data integrity of active projects is protected and I do not inadvertently corrupt an existing estimate.

Acceptance Criteria:

• Given a dimension tag is assigned to one or more items within an active Estimate, When I attempt to delete that tag from the Dimension Library, Then the system must perform a usage check across all active Estimates.

• Given the check finds the tag is in use, Then the system must block the deletion action.

• Given the deletion is blocked, Then a clear error message must be displayed, stating, "This tag cannot be deleted because it is currently in use in one or more Estimates."

#### Test Checklist

- [ ] Prevent Deletion of an “In-Use” Tag (In the item Library)
- [ ] Given a hierarchy record in the Dimensions Library is assigned to one or more items on the item library, When I attempt to delete that specific hierarchy record, Then the system must block the deletion action.
- [ ] Given the deletion is blocked, Then the system must display a clear and informative error message explaining why the action failed (e.g., "This tag cannot be deleted because it is currently in use by one or more library items.").
- [ ] Prevent Deletion of an “In-Use” Tag (in the WBS)
- [ ] Given a dimension tag is assigned to one or more items within an active Estimate, When I attempt to delete that tag from the Dimension Library, Then the system must perform a usage check across all active Estimates.
- [ ] Given the check finds the tag is in use, Then the system must block the deletion action.
- [ ] Given the deletion is blocked, Then a clear error message must be displayed, stating, "This tag cannot be deleted because it is currently in use in one or more Estimates."

### VER10-8707: Admin FE- Import Dimensions from Excel

**Status:** Closed | **Points:** 2
**FR Trace:** FR1170, FR782

#### Description

User Story

As a System Admin, I want to upload a spreadsheet to efficiently populate or update a dimension library (for Assets, Locations, or Suppliers), with clear validation and feedback, So that I can quickly establish the master hierarchical data that will be used for tagging across the application.


Acceptance Criteria:

1. Initiating the Import Process:

• Given I am in the "Dimensions Library" and have selected the correct dimension type (e.g. "Asset"), When I click the "Import" button in the top right corner, Then an "Upload a spreadsheet" modal/pop-up appears.

• Given the "Upload a spreadsheet" modal is open, When I click the "Browse" button, Then my device's native file explorer opens, allowing me to select a compatible file (e.g. .xsxl, .csv).

• Given I have selected  the correct file format, When the file name appears in the modal, Then the "Upload" button becomes enabled. 
• Invalid file formats must not be permitted and will adhere to established system validation rules


1. Data Validation and Error Handling:

• Given I have clicked the "Upload" button, Then the system must parse the spreadsheet and validate its contents against required formatting rules before committing any data.

• Given the spreadsheet contains syntax issues, When the validation check is complete, Then a new modal must appear, clearly stating that "The spreadsheet contains invalid data" and must allow the user to re-generate the spreadsheet with the issues highlighted

• Given the "Syntax Errors" modal is displayed, Then I must be presented with two options: "Cancel" to abort the import entirely, or "re-generate the spreadsheet" to re-generate the spreadsheet with the issues highlighted.


1. Successful Import and UI Feedback:

• Given I proceed with an upload valid file(i.e. free of syntax errors) , Then the system must import the data and structure it into the correct hierarchical format within the selected dimension library.

• Given the data has been successfully imported, When the UI refreshes, Then a green confirmation toast/notification appears at the bottom of the screen with the message "Dimensions data successfully imported".

• Given the import is complete, When I view the Dimension Library, Then the newly imported data is displayed correctly, showing the hierarchical structure as defined in the spreadsheet.

• Given the data is now in the library, Then each column and entry should be enabled and interactive as per standard Dimension Library functionality.

#### Test Checklist

- [ ] Given I am in the "Dimensions Library" and have selected the correct dimension type (e.g. "Asset"), When I click the "Import" button in the top right corner, Then an "Upload a spreadsheet" modal/pop-up appears.
- [ ] Given the "Upload a spreadsheet" modal is open, When I click the "Browse" button, Then my device's native file explorer opens, allowing me to select a compatible file (e.g. .xsxl, .csv).
- [ ] Given I have selected  the correct file format, When the file name appears in the modal, Then the "Upload" button becomes enabled.
- [ ] Invalid file formats must not be permitted and will adhere to established system validation rules
- [ ] Given I have clicked the "Upload" button, Then the system must parse the spreadsheet and validate its contents against required formatting rules before committing any data.
- [ ] Given the spreadsheet contains syntax issues, When the validation check is complete, Then a new modal must appear, clearly stating that "The spreadsheet contains invalid data" and must allow the user to re-generate the spreadsheet with the issues highlighted
- [ ] Given the "Syntax Errors" modal is displayed, Then I must be presented with two options: "Cancel" to abort the import entirely, or "re-generate the spreadsheet" to re-generate the spreadsheet with the issues highlighted.
- [ ] Given I proceed with an upload valid file(i.e. free of syntax errors) , Then the system must import the data and structure it into the correct hierarchical format within the selected dimension library.
- [ ] Given the data has been successfully imported, When the UI refreshes, Then a green confirmation toast/notification appears at the bottom of the screen with the message "Dimensions data successfully imported".
- [ ] Given the import is complete, When I view the Dimension Library, Then the newly imported data is displayed correctly, showing the hierarchical structure as defined in the spreadsheet.
- [ ] Given the data is now in the library, Then each column and entry should be enabled and interactive as per standard Dimension Library functionality.
- [ ] Initiating the Import Process:
- [ ] Data Validation and Error Handling:
- [ ] Successful Import and UI Feedback:

### VER10-8718: Manage System Wide VAT Rate -UI

**Status:** Ready for release | **Points:** 1

#### Description

User Story:

As a System Admin, I need to set a single, system wide VAT percentage, so that all VAT related calculations including Non-Recoverable VAT (NRVAT) across the platform are consistent and use the correct rate.


Acceptance Criteria

1. Access: The System Admin can navigate to the Administration Menu and access the Tax System settings screen.

2. Configuration Field: The System Admin must be able to specify the system wide VAT rate using a numeric input field labelled "Tax System (Percentage)."

3. Data Validation (VAT Rate): The input field for the VAT rate must enforce the following:
• Numeric Only: Only numeric values (including decimals) are accepted.

• Range: The value must be between 0.00 and 100.00.

• Required: The field must not be empty.

4. Fiscal Year Configuration: The Admin must be able to define the start date for the fiscal year using a date input field labelled "Fiscal start day/month."
• Input Type: This must be presented using a date picker UI component to prevent manual entry errors.

• The system should default the end date to start date minus 1.

5. Data Constraint (Save): The system must enforce that a single, validated percentage value is entered and saved.

6. Project Override Control: The screen must contain a checkbox option (Allow Edit of VAT in Project) that, when deselected, locks the VAT rate at the project level, ensuring the central system-wide rate is used for all calculations.

7. Data Application: The saved rate must be correctly applied to all platform calculations requiring VAT or Non-Recoverable VAT (NRVAT) across all projects.


V8 screen shot

#### Test Checklist

- [ ] Numeric Only: Only numeric values (including decimals) are accepted.
- [ ] Range: The value must be between 0.00 and 100.00.
- [ ] Required: The field must not be empty.
- [ ] Input Type: This must be presented using a date picker UI component to prevent manual entry errors.
- [ ] The system should default the end date to start date minus 1.
- [ ] Access: The System Admin can navigate to the Administration Menu and access the Tax System settings screen.
- [ ] Configuration Field: The System Admin must be able to specify the system wide VAT rate using a numeric input field labelled "Tax System (Percentage)."
- [ ] Data Validation (VAT Rate): The input field for the VAT rate must enforce the following:
- [ ] Required: The field must not be empty.
- [ ] Fiscal Year Configuration: The Admin must be able to define the start date for the fiscal year using a date input field labelled "Fiscal start day/month."
- [ ] Data Constraint (Save): The system must enforce that a single, validated percentage value is entered and saved.
- [ ] Project Override Control: The screen must contain a checkbox option (Allow Edit of VAT in Project) that, when deselected, locks the VAT rate at the project level, ensuring the central system-wide rate is used for all calculations.
- [ ] Data Application: The saved rate must be correctly applied to all platform calculations requiring VAT or Non-Recoverable VAT (NRVAT) across all projects.

### VER10-8720: Manage Time Division Periods for Spend Profiles -UI

**Status:** Ready for release | **Points:** 1
**FR Trace:** FR890

#### Description

Manage Time Division Periods for Spend Profiles As a System Admin, I need to define and manage the 20 time division periods, so that these time buckets can be used consistently across all default spend profiles for accurate expenditure forecasting.

Acceptance Criteria:

1. Access: The System Admin can navigate to the Administration Menu and access the National Highways sub-tab, then select Spend Profile

2. Read-Only Count: The screen must display the fixed value of 20 in the "Number of time divisions in Spend Profile" field, and this field must be read-only to ensure system-wide consistency.

3. Data Application: The system must store the 20 time divisions, which are then used as the column headers when importing Master Spend Profiles (as per the requirement above  i.e. Manage Master Spend Profiles  and in any associated forecasting reports.

4. Database structure: The backend DB will support up to 30 Time divisions



V8 Screen shot

#### Test Checklist

- [ ] Access: The System Admin can navigate to the Administration Menu and access the National Highways sub-tab, then select Spend Profile
- [ ] Read-Only Count: The screen must display the fixed value of 20 in the "Number of time divisions in Spend Profile" field, and this field must be read-only to ensure system-wide consistency.
- [ ] Data Application: The system must store the 20 time divisions, which are then used as the column headers when importing Master Spend Profiles (as per the requirement above  i.e. Manage Master Spend Profiles  and in any associated forecasting reports.
- [ ] Database structure: The backend DB will support up to 30 Time divisions

### VER10-8721: Manage NRVAT % i.e. Non Recoverable VAT -UI

**Status:** Ready for release | **Points:** 0.5

#### Description

User story

As an System Admin, I need the  NRVAT Hybrid % captured at estimate level, and to be able to specify which Cost elements require an NR Vat % applied so that the system can use these values for automated calculations in the CCESS report.

This requirement is for a  field within the Estimate details where an estimator inputs the specific Non-Recoverable VAT Hybrid percentage that applies only to their estimate. This value is then used by the system as the rate for the NRVAT Hybrid calculation.

Acceptance Criteria

1. Access: NR Vat Hybrid can be defined at estimate level within the estimate details.

2. Configuration Field: The Estimator must be able to specify the NR VAT rate using a numeric input field labelled "NR VAT Hybrid Rate %."

3. Data Validation (VAT Rate): The input field for the NR VAT Hybrid % rate must enforce the following:
• Numeric Only: Only numeric values (including decimals) are accepted.

• Range: The value must be between 0.00 and 100.00.

• Required: The field must not be empty.

4. Data Constraint (Save): The system must enforce that a single, validated percentage value is entered and saved.

5. Data Application: The saved rate must be correctly applied to all  calculations requiring Non-Recoverable VAT (NRVAT) across the specified estimate.

#### Test Checklist

- [ ] Numeric Only: Only numeric values (including decimals) are accepted.
- [ ] Range: The value must be between 0.00 and 100.00.
- [ ] Required: The field must not be empty.
- [ ] Access: NR Vat Hybrid can be defined at estimate level within the estimate details.
- [ ] Configuration Field: The Estimator must be able to specify the NR VAT rate using a numeric input field labelled "NR VAT Hybrid Rate %."
- [ ] Data Validation (VAT Rate): The input field for the NR VAT Hybrid % rate must enforce the following:
- [ ] Required: The field must not be empty.
- [ ] Data Constraint (Save): The system must enforce that a single, validated percentage value is entered and saved.
- [ ] Data Application: The saved rate must be correctly applied to all  calculations requiring Non-Recoverable VAT (NRVAT) across the specified estimate.

### VER10-8722: Standard Codes Configuration -UI

**Status:** Ready for release | **Points:** 3

#### Description

User Story

As a System Admin, I need a single, centralized interface to Create, Read, Update, and Delete (CRUD) all core National Highways reference lists (Codes), including Estimate Scheme Types, Estimate Stages, Estimate Classifications/Levels, Spend Profile Types and Report Structure, so that the system ensures consistent project classification, maturity assessment, and expenditure forecasting based on predefined, hierarchical rules.

Acceptance Criteria:

1. Access and Navigation: The System Admin can access a dedicated screen titled "Standard Codes" which is accessible under Admin Codes Library

2. View Separation: The screen must display a list of all Code Types on the left panel (e.g Estimate stage type, Scheme Type), and the details of the selected Code Type on the right.

3. CRUD Functionality: The System Admin can Create, Read, Update, and Delete (CRUD) items within each list.

4. Deletion Prevention (In Use): The system prevents a hard delete of any Code if it is currently mapped to a configuration table (e.g. Spend Profile mapping) or actively referenced by a live estimate. A clear error message must be displayed. “Code name is in use and cannot be deleted”

5. Data Structure: Creating a new code item requires the Admin to input a unique Code/ Code Description.

6. Life Cycle Stage Filtering: The UI must include a mandatory "Lifecycle Stage" dropdown that allows the Admin to view and configure the code list specifically for the selected Life Cycle

7. Life Cycle Stage Configuration: When creating or editing any code variant, the code is automatically associated with the currently selected Life Cycle Stage from the dropdown before saving.

8. Code Duplication (Copy to All): The System Admin must have a "Copy to all lifecycles" function that copies the currently displayed and configured variants for the selected Life Cycle Stage to all other available Life Cycle Stages (including a confirmation prompt/warning regarding overwriting data).
1. The system must display a prompt before the “copy to all” action is committed : “You are about to copy all the configured codes for the currently selected Lifecycle Stage ([Insert Current Lifecycle Stage Here]) to all other available Lifecycle Stages. Do you want to procced”. 

2. Options available are Cancel and Ok. 

9. Unsaved Changes Control: The "Copy to all lifecycles" function must be disabled if there are unsaved changes to the variants in the current view

10. The following system codes must have a lifecycle filter:
1. Estimate Stage

2. Estimate Classification/ Estimate Level  

3. Scheme Type

4. Spend Profile type  

5. Economic Output (EO)  Description

6. Organisation 

7. Report Structure  





The Data below is required for configuration for National highways 

[Table content]

[Table content]

[Table content]

[Table content]

#### Test Checklist

- [ ] Access and Navigation: The System Admin can access a dedicated screen titled "Standard Codes" which is accessible under Admin Codes Library
- [ ] View Separation: The screen must display a list of all Code Types on the left panel (e.g Estimate stage type, Scheme Type), and the details of the selected Code Type on the right.
- [ ] CRUD Functionality: The System Admin can Create, Read, Update, and Delete (CRUD) items within each list.
- [ ] Deletion Prevention (In Use): The system prevents a hard delete of any Code if it is currently mapped to a configuration table (e.g. Spend Profile mapping) or actively referenced by a live estimate. A clear error message must be displayed. “Code name is in use and cannot be deleted”
- [ ] Data Structure: Creating a new code item requires the Admin to input a unique Code/ Code Description.
- [ ] Life Cycle Stage Filtering: The UI must include a mandatory "Lifecycle Stage" dropdown that allows the Admin to view and configure the code list specifically for the selected Life Cycle
- [ ] Life Cycle Stage Configuration: When creating or editing any code variant, the code is automatically associated with the currently selected Life Cycle Stage from the dropdown before saving.
- [ ] Code Duplication (Copy to All): The System Admin must have a "Copy to all lifecycles" function that copies the currently displayed and configured variants for the selected Life Cycle Stage to all other available Life Cycle Stages (including a confirmation prompt/warning regarding overwriting data).
- [ ] The system must display a prompt before the “copy to all” action is committed : “You are about to copy all the configured codes for the currently selected Lifecycle Stage ([Insert Current Lifecycle Stage Here]) to all other available Lifecycle Stages. Do you want to procced”.
- [ ] Options available are Cancel and Ok.
- [ ] Unsaved Changes Control: The "Copy to all lifecycles" function must be disabled if there are unsaved changes to the variants in the current view
- [ ] The following system codes must have a lifecycle filter:
- [ ] Estimate Stage
- [ ] Estimate Classification/ Estimate Level
- [ ] Scheme Type
- [ ] Spend Profile type
- [ ] Economic Output (EO)  Description
- [ ] Organisation
- [ ] Report Structure

### VER10-8724: Manage Section Library - UI

**Status:** Ready for release | **Points:** 1

#### Description

User Story

As a System Admin, I need to create, update, and manage the master list of work sections, so that estimators can build their cost estimates from a standardised and centrally controlled structure.


Acceptance Criteria:

1. Location & Access: The System Admin can access the Sections Library via the Main Libraries Menu.

2. Hierarchy Position: The Main library Menu represents the hierarchy of the estimate structure i.e. (Section), which is followed by Cost Elements, Items, Resources, and Variables and is ordered as such.

3. CRUD Functionality: The System Admin can Create, Read, Update, and Delete (CRUD) entries in the Section Library.

4. Data Fields: Each section entry must support fields for Section Number (unique code), Description, a Life Cycle Stage selector.

5. Life Cycle Stage Association: The System Admin must select the applicable Life Cycle Stage for a Section before saving the configuration.

6. Deletion Prevention (In Use): The system prevents a hard delete of a Section if it is currently linked to any active Cost Element configuration or used in a live estimate structure. A clear warning must be provided.
1. the system must prevent deletions for In use sections

2. the system must prompt the user with the message : “This section is in-use and cannot be deleted”

3. the system admin must be able to acknowledge and close this message

7. Saving Changes: The system must ensure all changes are committed by the sys admin 
1. Options available are Cancel and Save.




V8 Screen shot

#### Test Checklist

- [ ] Location & Access: The System Admin can access the Sections Library via the Main Libraries Menu.
- [ ] Hierarchy Position: The Main library Menu represents the hierarchy of the estimate structure i.e. (Section), which is followed by Cost Elements, Items, Resources, and Variables and is ordered as such.
- [ ] CRUD Functionality: The System Admin can Create, Read, Update, and Delete (CRUD) entries in the Section Library.
- [ ] Data Fields: Each section entry must support fields for Section Number (unique code), Description, a Life Cycle Stage selector.
- [ ] Life Cycle Stage Association: The System Admin must select the applicable Life Cycle Stage for a Section before saving the configuration.
- [ ] Deletion Prevention (In Use): The system prevents a hard delete of a Section if it is currently linked to any active Cost Element configuration or used in a live estimate structure. A clear warning must be provided.
- [ ] the system must prevent deletions for In use sections
- [ ] the system must prompt the user with the message : “This section is in-use and cannot be deleted”
- [ ] the system admin must be able to acknowledge and close this message
- [ ] Saving Changes: The system must ensure all changes are committed by the sys admin
- [ ] Options available are Cancel and Save.

### VER10-8725: Manage Cost Elements Library - UI

**Status:** Ready for release | **Points:** 1
**FR Trace:** FR830

#### Description

User Story 

As a System Admin, I need to create, update, and manage the fundamental cost for each programme type elements, so that there is a complete and accurate library of all possible cost building blocks for an estimate.

Acceptance Criteria


1. Location & Access: The System Admin can access the Cost Element Library via the Main Libraries Menu.

2. Hierarchy Position: The Main library Menu represents the hierarchy of the estimate structure i.e. Section, which is followed by Cost Elements, Items, Resources, and Variables and is ordered as such.

3. CRUD Functionality: The System Admin can Create, Read, Update, and Delete (CRUD) entries in the Section Library.

4. Data Fields: Each section entry must support fields for Section Number (unique code), Description, a Life Cycle Stage selector.

5. Life Cycle Stage Association: The System Admin must select the applicable Life Cycle Stage for a Cost Element before saving the configuration.
1. the system must not commit changes for new Cost Elements if no lifecycle stage has been selected

2. the system must display a message : “Mandatory Field Missing: Life Cycle Stage. You must select an applicable Life Cycle Stage for this Cost Element before you can save the configuration”

3. the system admin must be able to acknowledge and close this message

6. Deletion Prevention (In Use): The system prevents a hard delete of a Cost Element if it is currently linked to any active Cost Element configuration or used in a live estimate structure. A clear warning must be provided.
1. the system must prevent deletions for In use Cost Elements

2. the system must prompt the user with the message : “This Cost Element is in-use and cannot be deleted”

3. the system admin must be able to acknowledge and close this message

7. Validation Message for Unsaved Changes: The system must ensures the sys admin does not lose their work if they try to navigate away from the library while editing or adding a Cost Element before saving.
1.  A clear warning must be provided. “You have made changes to the current Cost Element that have not been saved. Do you want to Save Changes, Or Cancel these changes?”

2. Options available are Cancel and Save.


V8 Screen shot

#### Test Checklist

- [ ] Location & Access: The System Admin can access the Cost Element Library via the Main Libraries Menu.
- [ ] Hierarchy Position: The Main library Menu represents the hierarchy of the estimate structure i.e. Section, which is followed by Cost Elements, Items, Resources, and Variables and is ordered as such.
- [ ] CRUD Functionality: The System Admin can Create, Read, Update, and Delete (CRUD) entries in the Section Library.
- [ ] Data Fields: Each section entry must support fields for Section Number (unique code), Description, a Life Cycle Stage selector.
- [ ] Life Cycle Stage Association: The System Admin must select the applicable Life Cycle Stage for a Cost Element before saving the configuration.
- [ ] the system must not commit changes for new Cost Elements if no lifecycle stage has been selected
- [ ] the system must display a message : “Mandatory Field Missing: Life Cycle Stage. You must select an applicable Life Cycle Stage for this Cost Element before you can save the configuration”
- [ ] the system admin must be able to acknowledge and close this message
- [ ] Deletion Prevention (In Use): The system prevents a hard delete of a Cost Element if it is currently linked to any active Cost Element configuration or used in a live estimate structure. A clear warning must be provided.
- [ ] the system must prevent deletions for In use Cost Elements
- [ ] the system must prompt the user with the message : “This Cost Element is in-use and cannot be deleted”
- [ ] the system admin must be able to acknowledge and close this message
- [ ] Validation Message for Unsaved Changes: The system must ensures the sys admin does not lose their work if they try to navigate away from the library while editing or adding a Cost Element before saving.
- [ ] A clear warning must be provided. “You have made changes to the current Cost Element that have not been saved. Do you want to Save Changes, Or Cancel these changes?”
- [ ] Options available are Cancel and Save.

### VER10-8726: Manage Cost Element Configuration - UI

**Status:** Ready for release | **Points:** 6

#### Description

User Story

As a System Admin, I need to manage a central configuration table for all cost elements mapped to their associated sections, so that I can preset specific  attributes like Historic CE, Apply NRVAT  etc to ensure consistent report generation.

Acceptance Criteria

1. Access and Context: The System Admin can navigate to the Cost Element Configuration screen via the Administration menu, which must display the currently selected Life Cycle Stage (Asset Renewals, Operations and Maintenance) and Report Structure (PCF/3D) in the header.
1. Life Cycle Stage Association: The System Admin must select the applicable Life Cycle Stage for a Cost Element configuration before saving the configuration.
1. Lifecycle stages : the applicable lifecycle stages are New Construction, Asset Renewals, Operations and Maintenance and LTA.
1. the system must not commit changes for a new configuration if no lifecycle stage has been selected

2. the system must display a message : “Mandatory Field Missing: Life Cycle Stage. You must select an applicable Life Cycle Stage for this Cost Element before you can save the configuration”

3. the system admin must be able to acknowledge and close this message

2. Report Structure Association: The System Admin must select the applicable Report Structure for a Cost Element configuration before saving the configuration.
1. Report Structure : the applicable Report Structure are PCF, 3D, O&M and LTA
1. the system must not commit changes for a new configuration if no Report Structure has been selected

2. the system must display a message : “Mandatory Field Missing: Report Structure. You must select an applicable Report Structure for this Cost Element before you can save the configuration”

3. the system admin must be able to acknowledge and close this message

2. Data Mapping: The screen must display a hierarchical view of the estimate structure (Sections and  Cost Elements) relevant to the selected Life Cycle, allowing the Admin to configure each Cost Element.
1. The system admin must be able to drag and drop Sections and Cost Elements from the right hand panel to the appropriate location in the cost element configuration mapping table

2. The system admin must also be able to re-order the positioning of the sections and cost elements 

3. Configurable Columns (Flags): The configuration table must include fields or checkboxes allowing the Admin to preset the following business rules:
• Historic CE (Checkbox): To flag if the Cost Element is an Historic Cost Element.

• Apply NRVAT (Checkbox): To flag if Non-Recoverable VAT should be applied during calculation.

• Assign UIA (Checkbox): To flag if the Unscheduled Items Allowance should be applied based on the Estimate Classification/Level.

4. Configurable Data Columns (Inputs): The configuration table must include the following inputs, allowing the Admin to centrally set defaults:
• Inflation Index (Dropdown/Input): To specify the default Inflation Index to be used for the Cost Element.

• Cost Element Base Date (Date Picker/Input): To specify the default base date for the cost element.

5. Spend Profile Linkage: The table must allow the Admin to select a default Spend Profile (from the Master Spend Profiles library) using a dropdown menu to be linked to the Cost Element for that specific lifecycle stage
1. The Spend profile must be mapped from the configured System Codes Library.

6. CRUD on Links: The Admin must be able to Add new Cost Element links (from the Cost Element Library), Duplicate existing configuration rows, and Delete (Unlink) configuration rows.

7. In validation Deletion Prevention (Unlink): The system should prevent the deletion (unlinking) of a Cost Element row from the configuration if that specific mapping is currently in use in a live estimate.
1. Deletion Prevention (In Use): The system prevents a hard delete of a Cost Element configuration if it is currently used in a live or historic estimate structure. A clear warning must be provided.
1. the system must prompt the user with the message : “This Cost Element configuration  is in-use and cannot be deleted”

2. the system admin must be able to acknowledge and close this message

8. Validation Message for Unsaved Changes: The system must ensure the sys admin does not lose their work if they try to navigate away from the Cost Element Configuration while editing or adding a Cost Element before saving.
1.  A clear warning must be provided. “You have made changes to the current Cost Element Configuration that have not been saved. Do you want to Save Changes, Or Cancel these changes?”

2. Options available are Cancel and Save.

#### Test Checklist

- [ ] Historic CE (Checkbox): To flag if the Cost Element is an Historic Cost Element.
- [ ] Apply NRVAT (Checkbox): To flag if Non-Recoverable VAT should be applied during calculation.
- [ ] Assign UIA (Checkbox): To flag if the Unscheduled Items Allowance should be applied based on the Estimate Classification/Level.
- [ ] Inflation Index (Dropdown/Input): To specify the default Inflation Index to be used for the Cost Element.
- [ ] Cost Element Base Date (Date Picker/Input): To specify the default base date for the cost element.
- [ ] Access and Context: The System Admin can navigate to the Cost Element Configuration screen via the Administration menu, which must display the currently selected Life Cycle Stage (Asset Renewals, Operations and Maintenance) and Report Structure (PCF/3D) in the header.
- [ ] Life Cycle Stage Association: The System Admin must select the applicable Life Cycle Stage for a Cost Element configuration before saving the configuration.
- [ ] Lifecycle stages : the applicable lifecycle stages are New Construction, Asset Renewals, Operations and Maintenance and LTA.
- [ ] the system must not commit changes for a new configuration if no lifecycle stage has been selected
- [ ] the system must display a message : “Mandatory Field Missing: Life Cycle Stage. You must select an applicable Life Cycle Stage for this Cost Element before you can save the configuration”
- [ ] the system admin must be able to acknowledge and close this message
- [ ] Report Structure Association: The System Admin must select the applicable Report Structure for a Cost Element configuration before saving the configuration.
- [ ] Report Structure : the applicable Report Structure are PCF, 3D, O&M and LTA
- [ ] the system must not commit changes for a new configuration if no Report Structure has been selected
- [ ] the system must display a message : “Mandatory Field Missing: Report Structure. You must select an applicable Report Structure for this Cost Element before you can save the configuration”
- [ ] the system admin must be able to acknowledge and close this message
- [ ] Data Mapping: The screen must display a hierarchical view of the estimate structure (Sections and  Cost Elements) relevant to the selected Life Cycle, allowing the Admin to configure each Cost Element.
- [ ] The system admin must be able to drag and drop Sections and Cost Elements from the right hand panel to the appropriate location in the cost element configuration mapping table
- [ ] The system admin must also be able to re-order the positioning of the sections and cost elements
- [ ] Configurable Columns (Flags): The configuration table must include fields or checkboxes allowing the Admin to preset the following business rules:
- [ ] Configurable Data Columns (Inputs): The configuration table must include the following inputs, allowing the Admin to centrally set defaults:
- [ ] Spend Profile Linkage: The table must allow the Admin to select a default Spend Profile (from the Master Spend Profiles library) using a dropdown menu to be linked to the Cost Element for that specific lifecycle stage
- [ ] The Spend profile must be mapped from the configured System Codes Library.
- [ ] CRUD on Links: The Admin must be able to Add new Cost Element links (from the Cost Element Library), Duplicate existing configuration rows, and Delete (Unlink) configuration rows.
- [ ] In validation Deletion Prevention (Unlink): The system should prevent the deletion (unlinking) of a Cost Element row from the configuration if that specific mapping is currently in use in a live estimate.
- [ ] Deletion Prevention (In Use): The system prevents a hard delete of a Cost Element configuration if it is currently used in a live or historic estimate structure. A clear warning must be provided.
- [ ] the system must prompt the user with the message : “This Cost Element configuration  is in-use and cannot be deleted”
- [ ] the system admin must be able to acknowledge and close this message
- [ ] Validation Message for Unsaved Changes: The system must ensure the sys admin does not lose their work if they try to navigate away from the Cost Element Configuration while editing or adding a Cost Element before saving.
- [ ] A clear warning must be provided. “You have made changes to the current Cost Element Configuration that have not been saved. Do you want to Save Changes, Or Cancel these changes?”
- [ ] Options available are Cancel and Save.

### VER10-8727: Manage Master Spend Profiles -UI

**Status:** In QA | **Points:** 2
**FR Trace:** FR890

#### Description

User Story

Manage Master Spend Profiles: As an Admin user, I want to import, view, and update default spend profiles for each scheme type using a standard Excel template, so that I can efficiently set up the foundational data required for expenditure forecasting.

• Acceptance Criteria (New, based on uploaded images):
1. Access and Filtering: The System Admin can access the Master Spend Profiles screen under the Administration menu, which must allow filtering by Lifecycle Stage and Scheme Type.
1. Life Cycle Stage Association: The System Admin must select the applicable Life Cycle Stage for a Cost Element configuration before saving the configuration.
1. Lifecycle stages : the applicable lifecycle stages are New Construction, Asset Renewals, Operations and Maintenance and LTA.
1. the system must not commit changes for a new Master spend profile configuration if no lifecycle stage has been selected

2. the system must display a message : “Mandatory Field Missing: Life Cycle Stage. You must select an applicable Life Cycle Stage for this Spend Profile before you can save the configuration”

3. the system admin must be able to acknowledge and close this message

2. Scheme Type Association: The System Admin must select the applicable Schema Type for a Spend profile configuration before saving the configuration.
1. Scheme Type : the applicable Scheme Types  are as per the attached
1. the system must not commit changes for a new configuration if no Scheme Type has been selected

2. the system must display a message : “Mandatory Field Missing: Scheme Type. You must select an applicable Scheme Type for this Spend Profile before you can save the configuration”

3. the system admin must be able to acknowledge and close this message

2. Data View: The screen displays a grid of configured spend profiles, where rows are defined by the Spend Profile Type (from the Codes Library) and columns are defined by the 20 Time Divisions

3. Import Functionality: The system must offer two distinct import options:
• Import all data: Upload a CSV to replace all existing row data across all Lifecycles and Scheme Types.

• Import this scheme only: Upload a CSV to replace existing row data only for the currently selected Lifecycle Stage and Scheme Type.

4. Export Functionality: The system must offer three distinct export options:
• Export all data: Download a CSV with all row data across all Lifecycles and Scheme Types.

• Export this scheme only: Download a CSV with all row data for the currently selected Lifecycle Stage and Scheme Type.

• Export template: Download a CSV with only the column headers (Profile Type and 20 Time Divisions) to be used for data preparation.

5. Data Validation (Critical): Upon import, the system must validate that the sum of the 20 time division percentages for each profile row is exactly 100%.

6. Validation Failure Handling: If validation fails (sum is not 100%), the import must be blocked, and an error message must be displayed, including the option to "Generate Report" (CSV) of the invalid spreadsheet with the invalid rows highlighted.

7. Data Constraint: The percentage values in the time division columns (1 through 20) must be read-only on the screen; updates are only possible via the import mechanism.

8. Database structure: The backend DB will support up to 30 Time divisions

#### Test Checklist

- [ ] Acceptance Criteria (New, based on uploaded images):
- [ ] Import all data: Upload a CSV to replace all existing row data across all Lifecycles and Scheme Types.
- [ ] Import this scheme only: Upload a CSV to replace existing row data only for the currently selected Lifecycle Stage and Scheme Type.
- [ ] Export all data: Download a CSV with all row data across all Lifecycles and Scheme Types.
- [ ] Export this scheme only: Download a CSV with all row data for the currently selected Lifecycle Stage and Scheme Type.
- [ ] Export template: Download a CSV with only the column headers (Profile Type and 20 Time Divisions) to be used for data preparation.
- [ ] Access and Filtering: The System Admin can access the Master Spend Profiles screen under the Administration menu, which must allow filtering by Lifecycle Stage and Scheme Type.
- [ ] Life Cycle Stage Association: The System Admin must select the applicable Life Cycle Stage for a Cost Element configuration before saving the configuration.
- [ ] Lifecycle stages : the applicable lifecycle stages are New Construction, Asset Renewals, Operations and Maintenance and LTA.
- [ ] the system must not commit changes for a new Master spend profile configuration if no lifecycle stage has been selected
- [ ] the system must display a message : “Mandatory Field Missing: Life Cycle Stage. You must select an applicable Life Cycle Stage for this Spend Profile before you can save the configuration”
- [ ] the system admin must be able to acknowledge and close this message
- [ ] Scheme Type Association: The System Admin must select the applicable Schema Type for a Spend profile configuration before saving the configuration.
- [ ] Scheme Type : the applicable Scheme Types  are as per the attached
- [ ] the system must not commit changes for a new configuration if no Scheme Type has been selected
- [ ] the system must display a message : “Mandatory Field Missing: Scheme Type. You must select an applicable Scheme Type for this Spend Profile before you can save the configuration”
- [ ] the system admin must be able to acknowledge and close this message
- [ ] Data View: The screen displays a grid of configured spend profiles, where rows are defined by the Spend Profile Type (from the Codes Library) and columns are defined by the 20 Time Divisions
- [ ] Import Functionality: The system must offer two distinct import options:
- [ ] Export Functionality: The system must offer three distinct export options:
- [ ] Data Validation (Critical): Upon import, the system must validate that the sum of the 20 time division percentages for each profile row is exactly 100%.
- [ ] Validation Failure Handling: If validation fails (sum is not 100%), the import must be blocked, and an error message must be displayed, including the option to "Generate Report" (CSV) of the invalid spreadsheet with the invalid rows highlighted.
- [ ] Data Constraint: The percentage values in the time division columns (1 through 20) must be read-only on the screen; updates are only possible via the import mechanism.
- [ ] Database structure: The backend DB will support up to 30 Time divisions

### VER10-8728: Manage Section to Stage Mapping - UI

**Status:** In Dev | **Points:** 2

#### Description

User Story

As a System Admin, I need a central screen to map (by Estimate lifecycle stage i.e. Operations and Maint, Asset Renewal, Major projects etc) each Section to its corresponding Estimate Stage, Organisation, and Economic Output Description, so that the estimate's structure is correctly aligned with the overall project lifecycle for consistent reporting and data analysis.

Acceptance Criteria

1. Access and Context: The System Admin can access this screen via the Administration Menu by selecting Section Mappings (as seen in the left-hand menu). The screen must allow filtering based on the overall Estimate Lifecycle Stage (e.g., Operations and Maintenance, Asset Renewal).
1. Life Cycle Stage Association: The System Admin must select the applicable Life Cycle Stage for a Cost Element configuration before saving the configuration.
1. Lifecycle stages : the applicable lifecycle stages are New Construction, Asset Renewals, Operations and Maintenance and LTA.
1. the system must not commit changes for a new configuration if no lifecycle stage has been selected

2. the system must display a message : “Mandatory Field Missing: Life Cycle Stage. You must select an applicable Life Cycle Stage before you can save the configuration”

3. the system admin must be able to acknowledge and close this message

2. Report Structure Association: The System Admin must select the applicable Report Structure before saving the configuration.
1. Report Structure : the applicable Report Structure are PCF, 3D, O&M and LTA
1. the system must not commit changes for a new configuration if no Report Structure has been selected

2. the system must display a message : “Mandatory Field Missing: Report Structure. You must select an applicable Report Structure before you can save the configuration”

3. the system admin must be able to acknowledge and close this message

2. Data View: The primary view must display a read-only list of all Sections (Code and Name) from the Section Library.
1. The system admin must be able to drag and drop Sections from the right hand panel to the appropriate location in the Sections mapping table

2. The system admin must also be able to re-order the positioning of the sections in the Sections mapping table

3. Mapping Fields (Dropdowns): For each Section row, the Admin must be able to select the required mappings via a dropdown:
• Estimate Stage: Mapped from the configured System Codes Library.

• Organisation: Mapped from from the configured System Codes Library.

• Economic Output Description (EO Description): Mapped  from the configured System Codes Library.

4. Mapping Application: The selected mappings are applied to the Section only for the currently selected Estimate Lifecycle Stage (e.g. LTA).

5. Data Enforcement: The selection of these mapping fields must be saved instantly or via a clear "Save" action, ensuring the relationship is applied across all new projects adhering to that Lifecycle Stage.

6. Validation Message for Unsaved Changes: The system must ensure the sys admin does not lose their work if they try to navigate away from the Sections mapping Table while editing or adding a section before saving.
1.  A clear warning must be provided. “You have made changes to the current Configuration that have not been saved. Do you want to Save Changes, Or Cancel these changes?”

2. Options available are Cancel and Save.

7. Deletion Prevention (Unlink): The system should prevent the deletion  (unlinking) of a Section row from the configuration if that specific mapping is currently in use in a live or historic estimate.
1. Deletion Prevention (In Use): The system prevents a hard delete of a Section mapping if it is currently used in a live or historic estimate structure. A clear warning must be provided.

2. the system must prompt the user with the message : “This Section Mapping configuration  is in-use and cannot be deleted”

3. the system admin must be able to acknowledge and close this message


V8 Screenshot

#### Test Checklist

- [ ] Estimate Stage: Mapped from the configured System Codes Library.
- [ ] Organisation: Mapped from from the configured System Codes Library.
- [ ] Economic Output Description (EO Description): Mapped  from the configured System Codes Library.
- [ ] Access and Context: The System Admin can access this screen via the Administration Menu by selecting Section Mappings (as seen in the left-hand menu). The screen must allow filtering based on the overall Estimate Lifecycle Stage (e.g., Operations and Maintenance, Asset Renewal).
- [ ] Life Cycle Stage Association: The System Admin must select the applicable Life Cycle Stage for a Cost Element configuration before saving the configuration.
- [ ] Lifecycle stages : the applicable lifecycle stages are New Construction, Asset Renewals, Operations and Maintenance and LTA.
- [ ] the system must not commit changes for a new configuration if no lifecycle stage has been selected
- [ ] the system must display a message : “Mandatory Field Missing: Life Cycle Stage. You must select an applicable Life Cycle Stage before you can save the configuration”
- [ ] the system admin must be able to acknowledge and close this message
- [ ] Report Structure Association: The System Admin must select the applicable Report Structure before saving the configuration.
- [ ] Report Structure : the applicable Report Structure are PCF, 3D, O&M and LTA
- [ ] the system must not commit changes for a new configuration if no Report Structure has been selected
- [ ] the system must display a message : “Mandatory Field Missing: Report Structure. You must select an applicable Report Structure before you can save the configuration”
- [ ] the system admin must be able to acknowledge and close this message
- [ ] Data View: The primary view must display a read-only list of all Sections (Code and Name) from the Section Library.
- [ ] The system admin must be able to drag and drop Sections from the right hand panel to the appropriate location in the Sections mapping table
- [ ] The system admin must also be able to re-order the positioning of the sections in the Sections mapping table
- [ ] Mapping Fields (Dropdowns): For each Section row, the Admin must be able to select the required mappings via a dropdown:
- [ ] Mapping Application: The selected mappings are applied to the Section only for the currently selected Estimate Lifecycle Stage (e.g. LTA).
- [ ] Data Enforcement: The selection of these mapping fields must be saved instantly or via a clear "Save" action, ensuring the relationship is applied across all new projects adhering to that Lifecycle Stage.
- [ ] Validation Message for Unsaved Changes: The system must ensure the sys admin does not lose their work if they try to navigate away from the Sections mapping Table while editing or adding a section before saving.
- [ ] A clear warning must be provided. “You have made changes to the current Configuration that have not been saved. Do you want to Save Changes, Or Cancel these changes?”
- [ ] Options available are Cancel and Save.
- [ ] Deletion Prevention (Unlink): The system should prevent the deletion  (unlinking) of a Section row from the configuration if that specific mapping is currently in use in a live or historic estimate.
- [ ] Deletion Prevention (In Use): The system prevents a hard delete of a Section mapping if it is currently used in a live or historic estimate structure. A clear warning must be provided.
- [ ] the system must prompt the user with the message : “This Section Mapping configuration  is in-use and cannot be deleted”
- [ ] the system admin must be able to acknowledge and close this message

### VER10-8732: Standardization of API endpoint and integration - UI

**Status:** Closed | **Points:** 2

### VER10-8735: BE - (Expected System Behaviour) Disabling an In-Use Dimension Level

**Status:** Ready for release | **Points:** 1
**FR Trace:** FR1170, FR782

#### Description

User Story

As a System  Admin, I want to disable an in-use dimension level and have its "disabled" status cascade everywhere it is currently configured, So that I can effectively phase out obsolete tags for new work while preserving historical data context and clearly communicating the tag's inactive status to all users.

Acceptance Criteria:

• Given a dimension level tag is assigned to at least one item in the Item Library, When I toggle that dimension level to "disabled," Then a confirmation modal must appear, warning me of the consequences. The System admin can choose to proceed with disabling that level or cancel the disable action.

• Given I confirm the action(i.e. proceed with disabling a dimension level) , When I view an item that uses this tag in the Item Library, Then the item will be tagged to the most granular level of that dimension.

• Given a dimension level is disabled, When I attempt to assign a tag from that dimension level to a different item, Then the disabled tag no longer appears as a selectable option in the Dimensions Library hierarchy in the WBS.

• Disabling an in-use dimension level will have its "disabled" status cascade everywhere it is currently configured,

#### Test Checklist

- [ ] Given a dimension level tag is assigned to at least one item in the Item Library, When I toggle that dimension level to "disabled," Then a confirmation modal must appear, warning me of the consequences. The System admin can choose to proceed with disabling that level or cancel the disable action.
- [ ] Given I confirm the action(i.e. proceed with disabling a dimension level) , When I view an item that uses this tag in the Item Library, Then the item will be tagged to the most granular level of that dimension.
- [ ] Given a dimension level is disabled, When I attempt to assign a tag from that dimension level to a different item, Then the disabled tag no longer appears as a selectable option in the Dimensions Library hierarchy in the WBS.
- [ ] Disabling an in-use dimension level will have its "disabled" status cascade everywhere it is currently configured,

### VER10-8736: UI - (Expected System Behaviours) Maintain Tagging in the Item Library When Hierarchy is Extended

**Status:** Ready for release | **Points:** -
**FR Trace:** FR1170, FR782

#### Description

### User Story

As a System  Admin, I expect an item's existing asset tag (i.e. as per the item library) to be updated to reflect the most granular tag as per the Dimensions library if I modify its parent hierarchy in the Dimension library by adding a new, more granular level, So that existing data is not altered without my direct action, and I have full control to manually review and re-assign tags as needed.

Acceptance Criteria:

• Given an item in the Item Library is tagged with a record that is currently the lowest level (e.g. "Footway"), And I edit the Dimensions Library to add a new child level under that record (e.g. "Concrete Footway" is added, making "Footway" an intermediate level), When I save the hierarchy change, Then the original item's tag must be updated "Concrete Footway".

#### Test Checklist

- [ ] Given an item in the Item Library is tagged with a record that is currently the lowest level (e.g. "Footway"), And I edit the Dimensions Library to add a new child level under that record (e.g. "Concrete Footway" is added, making "Footway" an intermediate level), When I save the hierarchy change, Then the original item's tag must be updated "Concrete Footway".

### VER10-8740: API - Dimension Tags UPSERT in ITEM LIBRARY

**Status:** Ready for release | **Points:** 1
**FR Trace:** FR1170, FR782

#### Description

Update the exisitng API /api/v2/item-library-v2/update to support Dimension Asset Tag in ItemLibrary. API will only store the ID of the hierarchy.Note : Only Asset can be tagged in ItemLibrary.

### VER10-8741: Increase the quote number length to 256 characters (backend) and UI adjust to fit the limit.

**Status:** Ready for release | **Points:** 2

#### Description

UI - 28 max length including  syntax and last quote numbersyntax = 18 characters ( code (3 ch)(optional) + year (4 ch) (optional) + remaining alphabets or special characters)last quote number = 10 characters (4 characters last quote number + 3 characters child estimate  + 3 character duplicate  = 10 )

4 Characters - for duplicate10 - last quote number4 - year (optional)3 - code (depot or project) - only one can be selected we are not supporting both Backend - 256 characters

#### Test Checklist

- [ ] max length including  syntax and last quote numbersyntax = 18 characters ( code (3 ch)(optional) + year (4 ch) (optional) + remaining alphabets or special characters)last quote number = 10 characters (4 characters last quote number + 3 characters child estimate  + 3 character duplicate  = 10 )
- [ ] for duplicate10 - last quote number4 - year (optional)3 - code (depot or project) - only one can be selected we are not supporting both Backend - 256 characters

### VER10-8742: “Child Estimate” appears in role-based access section only if Parent-Child hierarchy is enabled.

**Status:** Ready for release | **Points:** 2

#### Description

Child Estimate permission should be available only whe parent-child hierarchy is enabled

1.

### VER10-8743: Auto allocation of asset tag for items imported by spreadsheet upload

**Status:** Ready for release | **Points:** 1
**FR Trace:** FR1170, FR782

#### Description

User Story

As an Estimator, I want to import a Bill of Quantities (BoQ) via spreadsheet without including dimension tags, So that the system automatically assigns the correct and up-to-date tags from the item libraries when auto allocate is invoked, ensuring data consistency and saving me from manual data entry.

• Given an Estimator imports a BoQ spreadsheet, then no tagging data is to be ingested into the system as part of the BoQ import

• When the estimator triggers “Auto allocate”  then the system must auto-allocate any dimension tags as available in the item library

#### Test Checklist

- [ ] Given an Estimator imports a BoQ spreadsheet, then no tagging data is to be ingested into the system as part of the BoQ import
- [ ] When the estimator triggers “Auto allocate”  then the system must auto-allocate any dimension tags as available in the item library

### VER10-8756: Failed to complete step 2 - Field restriction not surfaced to the user 

**Status:** Closed | **Points:** 1

#### Description

Request an Estimate with 3 estimates. 

• Same name for each estimate name

• Use 250+ character for the estimate name 

• Use 256+ words for the Reason for Estimate

Error message due to internal server error: 

{
    "error": {
        "code": "InternalServerError",
        "message": "Internal Server Error",
        "details": [
            {
                "code": "Invalid",
                "target": "",
                "message": "An error occurred while saving the entity changes. See the inner exception for details."
            }
        ]
    }
}
No explanation to the user / not constraint implemented on the UI to prevent wrong input.  


To enhance

• There is a unknown character limit on the Reason for Estimate. It worked with 20 characters.

• I think the 3 estimate names should be different? TBC

#### Test Checklist

- [ ] Same name for each estimate name
- [ ] Use 250+ character for the estimate name
- [ ] Use 256+ words for the Reason for Estimate
- [ ] There is a unknown character limit on the Reason for Estimate. It worked with 20 characters.
- [ ] I think the 3 estimate names should be different? TBC

### VER10-8761: API - Update Item Library Import/Export API to handle the new hierarchy fields.

**Status:** Ready for release | **Points:** 1
**FR Trace:** FR1170, FR782

#### Description

Need a support to import & Export the Dimensions (Asset, Location & Supplier) in Item Library.We need to support full hierarchy Import & Export.API ENDPOINT [EXISTING]GET/api/v2/item-library-v2/exportPO  /api/v2/item-library-v2/import-excel

### VER10-8765: RFE 2.0- Editing the RFE Screen 2 Dropdown option Estiamte type+ Project Delivery Lifecycyle Stage+ Estimate Classification (FrontEnd)

**Status:** Ready for release | **Points:** 3
**FR Trace:** FR180

#### Description

Scenario 01 Estimate Outputype dropdown Given I am an ERC

And I am on the screen 2 for the requet for estimate 

And I have selected the Portfolio and the programme on screen 1

When I am selecting the Estimate type dropdown

Then I will see the dropdown options filtered by my Programme selection  

[Table content]

And I will be able to select one option from the Estimate output type dropdown

And where I go back to screen 1 and change the Portfolio or the Programme the estimate type selection will reset.Scenario 02 Project Delivery Lifecycle Stage dropdown 

Given I am an ERC

And I am on the screen 2 for the requet for estimate 

And I have selected the Portfolio and the programme on screen 1

When I am selecting the Project delivery life cycle stage dropdown

Then I will see the dropdown options filtered by my Portfoolio and Programme selectionRelationship Table: Portfolio → Programme → Stage

[Table content]

  Scenario 03 Project Delivery Lifecycle Stage dropdown 

Given I am an ERC

And I am on the screen 2 for the request for estimate 

And I have selected the Portfolio and the programme on screen 1

When I am selecting the estimate classification dropdown

Then I will see the dropdown options filtered by my Portfolio and Programme selection


[Table content]

### VER10-8766: Epic 9-Filters the resources based on Resource filter type

**Status:** Ready for release | **Points:** 5
**FR Trace:** FR511

#### Description

As an EstimatorI want the system to highlight and manage resources that are missing carbon values in the WBS screenSo that I can either apply a fallback cost-to-carbon factor or mark them as rejected, ensuring all resources are properly accounted for in carbon calculations.


### Filter Resources Missing Carbon Values 

Given I am on the WBS screenAnd I have an estimate template loadedAnd I have brought in resources via auto-allocate, manual drag & drop, or manual creationAnd the system has identified that some resources do not have a carbon valueThen I should see those resources highlighted as per the UI (Figma)And I should see a red question mark symbol next to each resource without a carbon valueAnd I should see a red exclamation mark at the top of the CO2e column.


Carbon Libraries

### VER10-8772: Bulk create/update/delete for estimator List - BE

**Status:** Ready for release | **Points:** 2
**FR Trace:** FR780, FR782

#### Description

Currently, the UI allows users to perform CRUD operations (Create, Update, Delete) locally on a Estimator List. Instead of tracking each individual change, the UI will send the entire updated list to the backend once the user confirms the changes.

This story is to implement the backend reconciliation logic that compares the received list with the existing database records and determines which records are:

• New → Create

• Modified → Update

• Missing from the new list → Soft Delete

The reconciliation will be handled server-side for simplicity and consistency, given the small data size (≤120 rows per request).

cc:

#### Test Checklist

- [ ] New → Create
- [ ] Modified → Update
- [ ] Missing from the new list → Soft Delete

### VER10-8773: Bulk create/update/delete for estimator List - FE

**Status:** Ready for release | **Points:** 2
**FR Trace:** FR780, FR782

#### Description

Currently, the UI allows users to perform CRUD operations (Create, Update, Delete) locally on a Estimator List. Instead of tracking each individual change, the UI will send the entire updated list to the backend once the user confirms the changes.

This story is to implement the backend reconciliation logic that compares the received list with the existing database records and determines which records are:

• New → Create

• Modified → Update

• Missing from the new list → Soft Delete

The reconciliation will be handled server-side for simplicity and consistency, given the small data size (≤120 rows per request).

cc:

#### Test Checklist

- [ ] New → Create
- [ ] Modified → Update
- [ ] Missing from the new list → Soft Delete

### VER10-8803: BE - (Admin) Warning on Dimension Hierarchy Modification

**Status:** Ready for release | **Points:** 1
**FR Trace:** FR1170, FR782

#### Description

User Story

As a System Admin, When I attempt to edit a Dimension hierarchy level in the Dimensions Library (i.e. Asset)that is already linked to one or more items, I want to be presented with a clear warning message about the potential impact on existing data, allowing me to make an informed decision.


Acceptance Criteria

• Given the Dimension hierarchy data for a Level (i.e. Asset) is tagged to at least one item in an Item Library, When an Admin tries to add a new, more granular level to that hierarchy in the Dimensions Library, Then a confirmation modal/warning must appear.

• The warning message should state: "This hierarchy structure is currently assigned to existing items in an Item Library, and this change will be reflected in associated Item libraries. Do you want to proceed? 

• Given the warning is displayed, Then the Admin must explicitly confirm they wish to proceed before the change is saved. 
• The options Cancel (to discard the changes) or Ok (to accept the changes) are available for selection

• Given the admin user selects cancel, then all changes must be discarded

• Given the admin user selects Ok, then the change must be reflected in all relevant item libraries

#### Test Checklist

- [ ] Given the Dimension hierarchy data for a Level (i.e. Asset) is tagged to at least one item in an Item Library, When an Admin tries to add a new, more granular level to that hierarchy in the Dimensions Library, Then a confirmation modal/warning must appear.
- [ ] The warning message should state: "This hierarchy structure is currently assigned to existing items in an Item Library, and this change will be reflected in associated Item libraries. Do you want to proceed?
- [ ] Given the warning is displayed, Then the Admin must explicitly confirm they wish to proceed before the change is saved.
- [ ] The options Cancel (to discard the changes) or Ok (to accept the changes) are available for selection
- [ ] Given the admin user selects cancel, then all changes must be discarded
- [ ] Given the admin user selects Ok, then the change must be reflected in all relevant item libraries

### VER10-8805: Manage System Wide VAT Rate -BE

**Status:** Ready for release | **Points:** 2

#### Description

User Story:

As a System Admin, I need to set a single, system wide VAT percentage, so that all VAT related calculations including Non-Recoverable VAT (NRVAT) across the platform are consistent and use the correct rate.


Acceptance Criteria

1. Access: The System Admin can navigate to the Administration Menu and access the Tax System settings screen.

2. Configuration Field: The System Admin must be able to specify the system wide VAT rate using a numeric input field labeled "Tax System (Percentage)."

3. Data Validation (VAT Rate): The input field for the VAT rate must enforce the following:
• Numeric Only: Only numeric values (including decimals) are accepted.

• Range: The value must be between 0.00 and 100.00.

• Required: The field must not be empty.

4. Fiscal Year Configuration: The Admin must be able to define the start date for the fiscal year using a date input field labeled "Fiscal start day/month."
• Input Type: This must be presented using a date picker UI component to prevent manual entry errors.

5. Data Constraint (Save): The system must enforce that a single, validated percentage value is entered and saved.

6. Project Override Control: The screen must contain a checkbox option (Allow Edit of VAT in Project) that, when deselected, locks the VAT rate at the project level, ensuring the central system-wide rate is used for all calculations.

7. Data Application: The saved rate must be correctly applied to all platform calculations requiring VAT or Non-Recoverable VAT (NRVAT) across all projects.

 

V8 screen shot

#### Test Checklist

- [ ] Numeric Only: Only numeric values (including decimals) are accepted.
- [ ] Range: The value must be between 0.00 and 100.00.
- [ ] Required: The field must not be empty.
- [ ] Input Type: This must be presented using a date picker UI component to prevent manual entry errors.
- [ ] Access: The System Admin can navigate to the Administration Menu and access the Tax System settings screen.
- [ ] Configuration Field: The System Admin must be able to specify the system wide VAT rate using a numeric input field labeled "Tax System (Percentage)."
- [ ] Data Validation (VAT Rate): The input field for the VAT rate must enforce the following:
- [ ] Required: The field must not be empty.
- [ ] Fiscal Year Configuration: The Admin must be able to define the start date for the fiscal year using a date input field labeled "Fiscal start day/month."
- [ ] Data Constraint (Save): The system must enforce that a single, validated percentage value is entered and saved.
- [ ] Project Override Control: The screen must contain a checkbox option (Allow Edit of VAT in Project) that, when deselected, locks the VAT rate at the project level, ensuring the central system-wide rate is used for all calculations.
- [ ] Data Application: The saved rate must be correctly applied to all platform calculations requiring VAT or Non-Recoverable VAT (NRVAT) across all projects.

### VER10-8806: Manage Time Division Periods for Spend Profiles - BE

**Status:** Ready for release | **Points:** 1

#### Description

Manage Time Division Periods for Spend Profiles As a System Admin, I need to define and manage the 20 time division periods, so that these time buckets can be used consistently across all default spend profiles for accurate expenditure forecasting.

Acceptance Criteria:

1. Access: The System Admin can navigate to the Administration Menu and access the National Highways sub-tab, then select Spend Profile

2. Read-Only Count: The screen must display the fixed value of 20 in the "Number of time divisions in Spend Profile" field, and this field must be read-only to ensure system-wide consistency.

3. Data Application: The system must store the 20 time divisions, which are then used as the column headers when importing Master Spend Profiles (as per the requirement above  i.e. Manage Master Spend Profiles  and in any associated forecasting reports.

4. Database structure: The backend DB will support up to 30 Time divisions

#### Test Checklist

- [ ] Access: The System Admin can navigate to the Administration Menu and access the National Highways sub-tab, then select Spend Profile
- [ ] Read-Only Count: The screen must display the fixed value of 20 in the "Number of time divisions in Spend Profile" field, and this field must be read-only to ensure system-wide consistency.
- [ ] Data Application: The system must store the 20 time divisions, which are then used as the column headers when importing Master Spend Profiles (as per the requirement above  i.e. Manage Master Spend Profiles  and in any associated forecasting reports.
- [ ] Database structure: The backend DB will support up to 30 Time divisions

### VER10-8807: Standard Codes Configuration - BE

**Status:** Ready for release | **Points:** 3

#### Description

User Story

As a System Admin, I need a single, centralized interface to Create, Read, Update, and Delete (CRUD) all core National Highways reference lists (Codes), including Estimate Scheme Types, Estimate Stages, Estimate Classifications/Levels, and Spend Profile Types and Report Structure, so that the system ensures consistent project classification, maturity assessment, and expenditure forecasting based on predefined, hierarchical rules.

Acceptance Criteria:

1. The System Admin can access a dedicated screen titled "Code library."

2. The screen provides separate views or tabs for managing Scheme Types, Estimate Stages, Estimate Classifications/Levels, and Spend Profile Types.

3. The System Admin can configure their values based on the parent Programme Type (e.g., 'Asset Renewals' or 'Major Projects').

4. The System Admin can perform standard CRUD operations (Add, Edit, Delete) for items within each list.

5. The system requires both a unique Code and a Description for every new item created.

6. Deleting a Code that is currently referenced by a configuration (e.g. a Spend Profile mapping) or an existing estimate is prevented

#### Test Checklist

- [ ] The System Admin can access a dedicated screen titled "Code library."
- [ ] The screen provides separate views or tabs for managing Scheme Types, Estimate Stages, Estimate Classifications/Levels, and Spend Profile Types.
- [ ] The System Admin can configure their values based on the parent Programme Type (e.g., 'Asset Renewals' or 'Major Projects').
- [ ] The System Admin can perform standard CRUD operations (Add, Edit, Delete) for items within each list.
- [ ] The system requires both a unique Code and a Description for every new item created.
- [ ] Deleting a Code that is currently referenced by a configuration (e.g. a Spend Profile mapping) or an existing estimate is prevented

### VER10-8808: Manage Section Library - BE

**Status:** Ready for release | **Points:** 2

#### Description

User Story

As a System Admin, I need to create, update, and manage the master list of work sections, so that estimators can build their cost estimates from a standardised and centrally controlled structure.


Acceptance Criteria





V8 Screen shot

### VER10-8809: Manage Cost Elements Library - BE

**Status:** Ready for release | **Points:** 3

#### Description

User Story 

As a System Admin, I need to create, update, and manage the fundamental cost for each programme type elements, so that there is a complete and accurate library of all possible cost building blocks for an estimate.

Acceptance Criteria




V8 Screen shot

### VER10-8810: Manage Cost Element Configuration - BE

**Status:** Ready for release | **Points:** 5

#### Description

User Story

As a System Admin, I need to manage a central configuration table for all cost elements mapped to their associated sections, so that I can preset specific  attributes like Historic CE, Apply NRVAT  etc to ensure consistent report generation.

Acceptance Criteria

### VER10-8812: Manage Section to Stage Mapping - BE

**Status:** Ready for release | **Points:** 3

#### Description

User Story

As a System Admin, I need a central screen to map (by Estimate lifecycle stage i.e. Operations and Maint, Asset Renewal, Major projects etc) each Section to its corresponding Estimate Stage, Organisation, and Economic Output Description, so that the estimate's structure is correctly aligned with the overall project lifecycle for consistent reporting and data analysis.

Acceptance Criteria

1. Access and Context: The System Admin can access this screen via the Administration Menu by selecting Section Mappings. 

2. Life Cycle Stage Association: The System Admin must select the applicable Life Cycle Stage before saving the configuration.

3. Data View: The primary view must display a read-only list of all Sections (Code and Name) from the Section Library as the base rows.

4. Mapping Fields (Dropdowns): For each Section row, the Admin must be able to select the required mappings via a dropdown:
• Estimate Stage: Mapped from the configured System Codes Library.

• Organisation: Mapped from the configured System Codes Library.

• Economic Output Description (EO Description): Mapped from the configured System Codes Library.

5. Mapping Application: The selected mappings are applied to the Section only for the currently selected Estimate Lifecycle Stage (e.g., Major Projects).

6. Data Enforcement: The selection of these mapping fields must be saved via a clear "Save" action, ensuring the relationship is applied across all new projects adhering to that Lifecycle Stage.

7. Data validation:
• An estimate stage , organisation and EO description must be selected before the Section mapping configuration can be saved 

• A lifecycle stage must be selected before the Section mapping configuration can be saved 




V8 Screenshot

#### Test Checklist

- [ ] Estimate Stage: Mapped from the configured System Codes Library.
- [ ] Organisation: Mapped from the configured System Codes Library.
- [ ] Economic Output Description (EO Description): Mapped from the configured System Codes Library.
- [ ] An estimate stage , organisation and EO description must be selected before the Section mapping configuration can be saved
- [ ] A lifecycle stage must be selected before the Section mapping configuration can be saved
- [ ] Access and Context: The System Admin can access this screen via the Administration Menu by selecting Section Mappings.
- [ ] Life Cycle Stage Association: The System Admin must select the applicable Life Cycle Stage before saving the configuration.
- [ ] Data View: The primary view must display a read-only list of all Sections (Code and Name) from the Section Library as the base rows.
- [ ] Mapping Fields (Dropdowns): For each Section row, the Admin must be able to select the required mappings via a dropdown:
- [ ] Mapping Application: The selected mappings are applied to the Section only for the currently selected Estimate Lifecycle Stage (e.g., Major Projects).
- [ ] Data Enforcement: The selection of these mapping fields must be saved via a clear "Save" action, ensuring the relationship is applied across all new projects adhering to that Lifecycle Stage.
- [ ] Data validation:

### VER10-8825: Dashboard - Displaying and Locating Custom Fields in the UI - Programme and Portfolio Details

**Status:** Ready for release | **Points:** 3
**FR Trace:** FR780, FR782

#### Description

As an Estimator, I want to easily find and access custom fields in a consistent location so that I can view and enter data efficiently.

Acceptance Criteria:

• Given custom fields are configured for programme and portfolio, then by default, they appear in a dedicated "Custom Fields" tab within that level's main view.

• If the Admin has checked the "Move to 'General' tab" option for a custom field, then that field will instead appear in a "Custom fields" section at the bottom of the "General" tab.

• The layout of fields within the "Custom Fields" tab or section should be a logical grid, and the panel should be scrollable if the number of fields exceeds the visible area.

#### Test Checklist

- [ ] Given custom fields are configured for programme and portfolio, then by default, they appear in a dedicated "Custom Fields" tab within that level's main view.
- [ ] If the Admin has checked the "Move to 'General' tab" option for a custom field, then that field will instead appear in a "Custom fields" section at the bottom of the "General" tab.
- [ ] The layout of fields within the "Custom Fields" tab or section should be a logical grid, and the panel should be scrollable if the number of fields exceeds the visible area.

### VER10-8873: UI Screens -  Create New Programme and Portfolio

**Status:** Ready for release | **Points:** 3
**FR Trace:** FR780, FR782

#### Description

As an Estimator, I want the ability to create a new Programme or Portfolio using a streamlined screen, so that I can quickly capture the essential administrative information (Title, Description, and Comments).

Acceptance Criteria:

Navigation and Initial View

• Trigger: When the Estimator clicks the "Add Programme" or "Add Portfolio" action on the Programme or Portfolio dashboard, a creation panel/screen must open on the right side of the view (similar to the "Create Project" UI).

• Initial State: The opened screen must default to and only display the General tab. 

• Title & Labeling: The screen title must be clearly labeled, for i.e. "Programme" or "Portfolio".


General Tab Fields (Mandatory Fields)

The General tab must contain only the following fields:

• Title: A single-line text input field labeled "Title".
• Validation: This field must be required (denoted by an asterisk *).

• Description: A multi-line text area field labeled "Description".
• Validation: This field must be required (denoted by an asterisk *).

• Comments: A multi-line text area field labeled "Comments".
• Validation: This field must be required (denoted by an asterisk *).

• Field Exclusion: No other fields are required on the General screen at this moment 


Submission and Workflow

 Save Action: The screen must contain a "Save" button.

• Clicking "Save" must validate that the Title, Description, and Comments fields are populated.

• Upon successful validation and saving, the new Programme or Portfolio must be created

• Dashboard Update: The newly created Programme or portfolio must immediately appear on the Programmes dashboard or Portfolio dashboard respectively  as a card  showing the captured Title

• Cancel Action: The screen must contain a "Cancel" button.
• Clicking "Cancel" must discard any entered data, close the creation screen, and return the user to the Programme / portfolio  dashboard without creating a new entity.

#### Test Checklist

- [ ] Trigger: When the Estimator clicks the "Add Programme" or "Add Portfolio" action on the Programme or Portfolio dashboard, a creation panel/screen must open on the right side of the view (similar to the "Create Project" UI).
- [ ] Initial State: The opened screen must default to and only display the General tab.
- [ ] Title & Labeling: The screen title must be clearly labeled, for i.e. "Programme" or "Portfolio".
- [ ] Title: A single-line text input field labeled "Title".
- [ ] Validation: This field must be required (denoted by an asterisk *).
- [ ] Description: A multi-line text area field labeled "Description".
- [ ] Validation: This field must be required (denoted by an asterisk *).
- [ ] Comments: A multi-line text area field labeled "Comments".
- [ ] Validation: This field must be required (denoted by an asterisk *).
- [ ] Field Exclusion: No other fields are required on the General screen at this moment
- [ ] Clicking "Save" must validate that the Title, Description, and Comments fields are populated.
- [ ] Upon successful validation and saving, the new Programme or Portfolio must be created
- [ ] Dashboard Update: The newly created Programme or portfolio must immediately appear on the Programmes dashboard or Portfolio dashboard respectively  as a card  showing the captured Title
- [ ] Cancel Action: The screen must contain a "Cancel" button.
- [ ] Clicking "Cancel" must discard any entered data, close the creation screen, and return the user to the Programme / portfolio  dashboard without creating a new entity.

### VER10-8923: Template Library - Preview - API

**Status:** Ready for release | **Points:** 2
**FR Trace:** FR820, FR830

### VER10-8924: Template Library - Preview

**Status:** Ready for release | **Points:** 2
**FR Trace:** FR820, FR830

### VER10-8961: Cost value not rolled up at Project/Portfolio/Programme levels

**Status:** Closed | **Points:** -

#### Description

Project/Programme/Portfolio costs are not updated along the estimates part of the hierarchy.

### VER10-8991: When we change the fields from the dropdown, the Codes and Numbering are getting reset to blank and ‘0000’.

**Status:** Ready for release | **Points:** 1

#### Description

Steps to Reproduce:

1. Login to Benchmark web application

2. Navigate to Admin → Admin → Quote Numbering → Estimate Numbering

3. Select Region from the drop down. Enter Code ad Numbering

4. Click on Save

5. 
6. Change the field from Region to Depot

7. 
8. 
9. Enter any value. Click on Save. 

10. 
11. Change from Depot to Region


Actual Result:

All the Codes and Numbering for the Region have been reset to blank and “0000”.


Expected Result:

The Codes and Numbering for the Region should not be reset. If the values are being reset, a pop-up message should be displayed to notify the user.

#### Test Checklist

- [ ] Login to Benchmark web application
- [ ] Navigate to Admin → Admin → Quote Numbering → Estimate Numbering
- [ ] Select Region from the drop down. Enter Code ad Numbering
- [ ] Click on Save
- [ ] Change the field from Region to Depot
- [ ] Enter any value. Click on Save.
- [ ] Change from Depot to Region

### VER10-8992: Data Import in order to test it out the fallback mechanism

**Status:** Ready for release | **Points:** 3
**FR Trace:** FR511

### VER10-8993: UI:Accepting the Fallback Cost-to-Carbon Factor

**Status:** Ready for release | **Points:** 3
**FR Trace:** FR511

#### Description

### Accepting the Fallback Cost-to-Carbon Factor

Given I have selected a resource missing a carbon valueAnd the UI modal suggests a fallback carbon value based on a cost-to-carbon factorWhen I select “Accept”Then the system should update all instances of that resource in the estimate using the formula:

Carbon value=Cost-to-carbon factor×Cost of the resourceCarbon value=Cost-to-carbon factor×Cost of the resource

And the system should mark the resource as “Cost to Carbon”And I should see “Cost to Carbon” displayed in the CO2e status column as per the UIAnd the system should mark the resource as “Assured” by displaying a green tickAnd the red question mark and red exclamation mark indicators for that resource should be cleared.

### VER10-8994: Rejecting the Fallback Cost-to-Carbon Factor

**Status:** Ready for release | **Points:** 5
**FR Trace:** FR511

#### Description

### Scenario 3: Rejecting the Fallback Cost-to-Carbon Factor

Given I have selected a resource missing a carbon valueAnd the UI modal suggests a fallback carbon value based on a cost-to-carbon factorWhen I select “Accept”Then all instances of that resource in the estimate should be marked as “Accepted”And The calculation will be done for accepted resources and change the status as costToCarbon

### VER10-8995: CLONE - Epic 9-Filters the resources based on Resource filter type

**Status:** Ready for release | **Points:** 5
**FR Trace:** FR511

#### Description

As an EstimatorI want the system to highlight and manage resources that are missing carbon values in the WBS screenSo that I can either apply a filters to see the status of resources i.e Suggested/Rejected.


### Filter Resources Missing Carbon Values 

Given I am on the WBS screenAnd I have an estimate template loadedAnd I have brought in resources via auto-allocate, manual drag & drop, or manual creationAnd the system has identified that some resources do not have a carbon valueThen I should see those resources based on filters I applied as per the UI (Figma)And I should see a either Rejected or Suggested Resource or it can be both


Carbon Libraries

### VER10-9074: Admin -> Estimate numbering -> Use Field numbering -> List for portfolio and Programme should be based on Admin hierarchy settings

**Status:** Ready for release | **Points:** -

#### Description

Based on selection in the Admin → Hierarchy , 




Admin -> Estimate numbering -> Use Field numbering -> List for portfolio and Program should be populated.

If Portfolio or Programme is selected only, it should come here. Otherwise, it should not populate in the user field-level numbering.

### VER10-9095: Validating Custom Field Data in the BE - Project Details

**Status:** Ready for release | **Points:** 1
**FR Trace:** FR780, FR782

#### Description

As a system user, I want my data entries to be validated against the field's required format in real-time, So that I can identify and correct errors immediately, ensuring the data I submit is accurate and complete.

Acceptance Criteria:

• Given I am entering data into an editable custom field, then the system must validate that the input matches the field's data type (e.g. Single-line Text, Multi-line Text, Selection (Dropdown), Date, and a combined Integer/Decimal type).
• When I enter data that does not match the required format (e.g. entering "abc" into an Integer field), then the field is highlighted with an error state, and an error message is displayed. Message: “Invalid value in Custom Field “insert name of custom field”. Please verify your input to continue”.

• User can select OK to exit the message and continue 

• The user cannot save the page until the validation error is corrected.

• The UI should clearly indicate the date type required in the input box for clarity for the estimator 


• Given I am viewing a custom field of Data Type “Single Line Text” that requires a validator as set up as system admin, then the system must validate that the data entered by the estimator is as per the defined validator for that custom field i.e. Apha numeric, numeric, alphabet or Email 
• When I enter data that does not match the validator format (e.g. entering "number or text" into a custom field with email validator), then the field is highlighted with an error state, and an error message is displayed. 

• Message: “Invalid value in Custom Field “insert name of custom field”. Please verify your input to continue”.

• User can select OK to exit the message and continue 

• The user cannot save the page until the validation error is corrected.

• The UI should clearly indicate the date type required in the input box for clarity for the estimator


• Given the system admin has specified that a Custom field is Mandatory on Create/edit , then the system must validate that the custom field is populated by the estimator on creation of an Estimate.
• When I try to Create and save a new estimate without populating a custom field that has been set up as “Mandatory on Create/edit”, then the system must display a message 

• Message: “Please complete mandatory field:  “insert name of custom field” to continue. 

• Where more than 1 mandatory field is missing, the names are listed out, separated by a comma. 

• User can select OK to exit the message and continue 

• The user cannot save the page until the mandatory custom field has been populated

#### Test Checklist

- [ ] Given I am entering data into an editable custom field, then the system must validate that the input matches the field's data type (e.g. Single-line Text, Multi-line Text, Selection (Dropdown), Date, and a combined Integer/Decimal type).
- [ ] When I enter data that does not match the required format (e.g. entering "abc" into an Integer field), then the field is highlighted with an error state, and an error message is displayed. Message: “Invalid value in Custom Field “insert name of custom field”. Please verify your input to continue”.
- [ ] User can select OK to exit the message and continue
- [ ] The user cannot save the page until the validation error is corrected.
- [ ] The UI should clearly indicate the date type required in the input box for clarity for the estimator
- [ ] Given I am viewing a custom field of Data Type “Single Line Text” that requires a validator as set up as system admin, then the system must validate that the data entered by the estimator is as per the defined validator for that custom field i.e. Apha numeric, numeric, alphabet or Email
- [ ] When I enter data that does not match the validator format (e.g. entering "number or text" into a custom field with email validator), then the field is highlighted with an error state, and an error message is displayed.
- [ ] Message: “Invalid value in Custom Field “insert name of custom field”. Please verify your input to continue”.
- [ ] User can select OK to exit the message and continue
- [ ] The user cannot save the page until the validation error is corrected.
- [ ] The UI should clearly indicate the date type required in the input box for clarity for the estimator
- [ ] Given the system admin has specified that a Custom field is Mandatory on Create/edit , then the system must validate that the custom field is populated by the estimator on creation of an Estimate.
- [ ] When I try to Create and save a new estimate without populating a custom field that has been set up as “Mandatory on Create/edit”, then the system must display a message
- [ ] Message: “Please complete mandatory field:  “insert name of custom field” to continue.
- [ ] Where more than 1 mandatory field is missing, the names are listed out, separated by a comma.
- [ ] User can select OK to exit the message and continue
- [ ] The user cannot save the page until the mandatory custom field has been populated

### VER10-9096: Validating Custom Field Data in the BE - Estimate Details

**Status:** Ready for release | **Points:** 2
**FR Trace:** FR780, FR782

#### Description

As a system user, I want my data entries to be validated against the field's required format in real-time, So that I can identify and correct errors immediately, ensuring the data I submit is accurate and complete.

Acceptance Criteria:

• Given I am entering data into an editable custom field, then the system must validate that the input matches the field's data type (e.g. Single-line Text, Multi-line Text, Selection (Dropdown), Date, and a combined Integer/Decimal type).
• When I enter data that does not match the required format (e.g. entering "abc" into an Integer field), then the field is highlighted with an error state, and an error message is displayed. Message: “Invalid value in Custom Field “insert name of custom field”. Please verify your input to continue”.

• User can select OK to exit the message and continue 

• The user cannot save the page until the validation error is corrected.

• The UI should clearly indicate the date type required in the input box for clarity for the estimator 


• Given I am viewing a custom field of Data Type “Single Line Text” that requires a validator as set up as system admin, then the system must validate that the data entered by the estimator is as per the defined validator for that custom field i.e. Apha numeric, numeric, alphabet or Email 
• When I enter data that does not match the validator format (e.g. entering "number or text" into a custom field with email validator), then the field is highlighted with an error state, and an error message is displayed. 

• Message: “Invalid value in Custom Field “insert name of custom field”. Please verify your input to continue”.

• User can select OK to exit the message and continue 

• The user cannot save the page until the validation error is corrected.

• The UI should clearly indicate the date type required in the input box for clarity for the estimator


• Given the system admin has specified that a Custom field is Mandatory on Create/edit , then the system must validate that the custom field is populated by the estimator on creation of an Estimate.
• When I try to Create and save a new estimate without populating a custom field that has been set up as “Mandatory on Create/edit”, then the system must display a message 

• Message: “Please complete mandatory field:  “insert name of custom field” to continue. 

• Where more than 1 mandatory field is missing, the names are listed out, separated by a comma. 

• User can select OK to exit the message and continue 

• The user cannot save the page until the mandatory custom field has been populated 


• Given the system admin has specified that a Custom field is Mandatory on Completion , then the system must validate that the custom field is populated by the estimator before an Estimate can be classed as completed.
• When I try to complete an estimate without populating a custom field that has been set up as “Mandatory on Completion”, then the system must display a message “Please complete mandatory field:  “insert name of custom field” to continue. 

• Where more than 1 mandatory field is missing, the names are listed out, separated by a comma. 

• User can select OK to exit the message and continue 

• The user cannot save/ complete the Estimate until the mandatory custom field has been populated 


• Given the system admin has specified that a Custom field is Available in WBS , then the system must display that custom field in the WBS

#### Test Checklist

- [ ] Given I am entering data into an editable custom field, then the system must validate that the input matches the field's data type (e.g. Single-line Text, Multi-line Text, Selection (Dropdown), Date, and a combined Integer/Decimal type).
- [ ] When I enter data that does not match the required format (e.g. entering "abc" into an Integer field), then the field is highlighted with an error state, and an error message is displayed. Message: “Invalid value in Custom Field “insert name of custom field”. Please verify your input to continue”.
- [ ] User can select OK to exit the message and continue
- [ ] The user cannot save the page until the validation error is corrected.
- [ ] The UI should clearly indicate the date type required in the input box for clarity for the estimator
- [ ] Given I am viewing a custom field of Data Type “Single Line Text” that requires a validator as set up as system admin, then the system must validate that the data entered by the estimator is as per the defined validator for that custom field i.e. Apha numeric, numeric, alphabet or Email
- [ ] When I enter data that does not match the validator format (e.g. entering "number or text" into a custom field with email validator), then the field is highlighted with an error state, and an error message is displayed.
- [ ] Message: “Invalid value in Custom Field “insert name of custom field”. Please verify your input to continue”.
- [ ] User can select OK to exit the message and continue
- [ ] The user cannot save the page until the validation error is corrected.
- [ ] The UI should clearly indicate the date type required in the input box for clarity for the estimator
- [ ] Given the system admin has specified that a Custom field is Mandatory on Create/edit , then the system must validate that the custom field is populated by the estimator on creation of an Estimate.
- [ ] When I try to Create and save a new estimate without populating a custom field that has been set up as “Mandatory on Create/edit”, then the system must display a message
- [ ] Message: “Please complete mandatory field:  “insert name of custom field” to continue.
- [ ] Where more than 1 mandatory field is missing, the names are listed out, separated by a comma.
- [ ] User can select OK to exit the message and continue
- [ ] The user cannot save the page until the mandatory custom field has been populated
- [ ] Given the system admin has specified that a Custom field is Mandatory on Completion , then the system must validate that the custom field is populated by the estimator before an Estimate can be classed as completed.
- [ ] When I try to complete an estimate without populating a custom field that has been set up as “Mandatory on Completion”, then the system must display a message “Please complete mandatory field:  “insert name of custom field” to continue.
- [ ] Where more than 1 mandatory field is missing, the names are listed out, separated by a comma.
- [ ] User can select OK to exit the message and continue
- [ ] The user cannot save/ complete the Estimate until the mandatory custom field has been populated
- [ ] Given the system admin has specified that a Custom field is Available in WBS , then the system must display that custom field in the WBS

### VER10-9098: Partial update for WBS - BE support

**Status:** Ready for release | **Points:** 2

### VER10-9139: Dashboard - Displaying and Locating Custom Fields in the Estimate Details

**Status:** Ready for release | **Points:** 3
**FR Trace:** FR780, FR782

#### Description

As an Estimator, I want to easily find and access custom fields in a consistent location so that I can view and enter data efficiently.

Acceptance Criteria - Estimate/Header Level Custom Fields:

• Given custom fields are configured for a specific level (e.g. Project or Estimate), then by default, they appear in a dedicated "Custom Fields" tab within that level's main view.
• If the Admin has checked the "Move to 'General' tab" option for a custom field, then that field will instead appear in a "Custom fields" section at the bottom of the "General" tab.

• The layout of fields within the "Custom Fields" tab or section should be a logical grid, and the panel should be scrollable if the number of fields exceeds the visible area.

• Custom fields of the Dropdown/List type must display a list of predefined options when clicked.


• Given I am viewing a custom field of Data Type “Single Line Text” that requires a validator as set up as system admin, then the system must validate that the data entered by the estimator is as per the defined validator for that custom field i.e. Apha numeric, numeric, alphabet or Email 
• When I enter data that does not match the validator format (e.g. entering "number or text" into a custom field with email validator), then the field is highlighted with an error state, and an error message is displayed. 

• Message: “Invalid value in Custom Field “insert name of custom field”. Please verify your input to continue”.

• User can select OK to exit the message and continue 

• The user cannot save the page until the validation error is corrected.

• The UI should clearly indicate the date type required in the input box for clarity for the estimator


• Given I am entering data into an editable custom field, then the system must validate that the input matches the field's data type (e.g. Single-line Text, Multi-line Text, Selection (Dropdown), Date, and a combined Integer/Decimal type).
• When I enter data that does not match the required format (e.g. entering "abc" into an Integer field), then the field is highlighted with an error state, and an error message is displayed. Message: “Invalid value in Custom Field “insert name of custom field”. Please verify your input to continue”.

• User can select OK to exit the message and continue 

• The user cannot save the page until the validation error is corrected.

• The UI should clearly indicate the date type required in the input box for clarity for the estimator

#### Test Checklist

- [ ] Estimate/Header Level Custom Fields:
- [ ] Given custom fields are configured for a specific level (e.g. Project or Estimate), then by default, they appear in a dedicated "Custom Fields" tab within that level's main view.
- [ ] If the Admin has checked the "Move to 'General' tab" option for a custom field, then that field will instead appear in a "Custom fields" section at the bottom of the "General" tab.
- [ ] The layout of fields within the "Custom Fields" tab or section should be a logical grid, and the panel should be scrollable if the number of fields exceeds the visible area.
- [ ] Custom fields of the Dropdown/List type must display a list of predefined options when clicked.
- [ ] Given I am viewing a custom field of Data Type “Single Line Text” that requires a validator as set up as system admin, then the system must validate that the data entered by the estimator is as per the defined validator for that custom field i.e. Apha numeric, numeric, alphabet or Email
- [ ] When I enter data that does not match the validator format (e.g. entering "number or text" into a custom field with email validator), then the field is highlighted with an error state, and an error message is displayed.
- [ ] Message: “Invalid value in Custom Field “insert name of custom field”. Please verify your input to continue”.
- [ ] User can select OK to exit the message and continue
- [ ] The user cannot save the page until the validation error is corrected.
- [ ] The UI should clearly indicate the date type required in the input box for clarity for the estimator
- [ ] Given I am entering data into an editable custom field, then the system must validate that the input matches the field's data type (e.g. Single-line Text, Multi-line Text, Selection (Dropdown), Date, and a combined Integer/Decimal type).
- [ ] When I enter data that does not match the required format (e.g. entering "abc" into an Integer field), then the field is highlighted with an error state, and an error message is displayed. Message: “Invalid value in Custom Field “insert name of custom field”. Please verify your input to continue”.
- [ ] User can select OK to exit the message and continue
- [ ] The user cannot save the page until the validation error is corrected.
- [ ] The UI should clearly indicate the date type required in the input box for clarity for the estimator

### VER10-9141: Update Estimate Level Custom Fields - Get - BE

**Status:** Ready for release | **Points:** 1
**FR Trace:** FR780, FR782

### VER10-9145: WBS - Entering and Updating Custom Field data in the WBS

**Status:** Ready for release | **Points:** 2
**FR Trace:** FR780, FR782

#### Description

As an Estimator, I want to easily find and access custom fields in a consistent location so that I can view and enter data efficiently.

Acceptance Criteria - Estimate/Header Level Custom Fields:


• Given I am in the WBS grid, and a custom field has been configured as “Available in WBS”, then that custom field must be available as a visible column in my WBS 
• The WBS grid must correctly render the different custom field data types e,g dates,  Dropdown values, etc

• And I can enter or select a value for that custom field depending on the custom field data type

• And these entered  values are stored against my estimate 


• Given I am in the WBS grid, and a custom field has been configured as “Available in WBS”  and “Estimator configurable list”, then I can define the selectable values for that custom field and that custom field must be available as a visible column in my WBS 
• The WBS grid must correctly render the different custom field data types i.e. Dropdown values

• And the WBS supports inline editing by clicking on the cell and selecting or entering the required value

• When I interact with a custom field data type “Selection/ list” in the WBS,  it must open a drop down selector with the full list of options.

• The dropdown selector for line-item custom fields must include a Search box to filter options.

• Selecting a value from the dropdown must update the cell value and immediately save the change to the line item data.

#### Test Checklist

- [ ] Estimate/Header Level Custom Fields:
- [ ] Given I am in the WBS grid, and a custom field has been configured as “Available in WBS”, then that custom field must be available as a visible column in my WBS
- [ ] The WBS grid must correctly render the different custom field data types e,g dates,  Dropdown values, etc
- [ ] And I can enter or select a value for that custom field depending on the custom field data type
- [ ] And these entered  values are stored against my estimate
- [ ] Given I am in the WBS grid, and a custom field has been configured as “Available in WBS”  and “Estimator configurable list”, then I can define the selectable values for that custom field and that custom field must be available as a visible column in my WBS
- [ ] The WBS grid must correctly render the different custom field data types i.e. Dropdown values
- [ ] And the WBS supports inline editing by clicking on the cell and selecting or entering the required value
- [ ] When I interact with a custom field data type “Selection/ list” in the WBS,  it must open a drop down selector with the full list of options.
- [ ] The dropdown selector for line-item custom fields must include a Search box to filter options.
- [ ] Selecting a value from the dropdown must update the cell value and immediately save the change to the line item data.

### VER10-9155: CLONE - Accepting the Fallback Cost-to-Carbon Factor

**Status:** Ready for release | **Points:** 1
**FR Trace:** FR511

#### Description

### Scenario 3: Rejecting the Fallback Cost-to-Carbon Factor

Given I have selected a resource missing a carbon valueAnd the UI modal suggests a fallback carbon value based on a cost-to-carbon factorWhen I select “Reject”Then all instances of that resource in the estimate should be marked as “Rejected”And I should see “Rejected” displayed in the CO2e status column as per the UIAnd I should see a red question mark symbol next to that resource to indicate it requires attentionAnd the red exclamation mark should remain visible at the top of the CO2e column.

### VER10-9157: Auto-scan resources for missing carbon values after auto-allocation

**Status:** Ready for release | **Points:** 5
**FR Trace:** FR511

#### Description

I want the system to automatically detect resources missing carbon values after auto-allocation,So that I can ensure the estimate has complete and accurate carbon data before proceeding further.

### Acceptance Criteria

1. Trigger
• The scan must automatically start immediately after the auto-allocation job finishes.

2. Scope of Scan
• The system must check all resources within the selected estimate.

• Resources should be validated against carbon factor data and carbon totals.

3. Detection Logic
• A resource is considered “missing carbon values” if any required carbon fields (e.g., A1–A3, A4, A5A, B2–B5, etc.) are null, zero (if not expected), or not calculated.

#### Test Checklist

- [ ] The scan must automatically start immediately after the auto-allocation job finishes.
- [ ] The system must check all resources within the selected estimate.
- [ ] Resources should be validated against carbon factor data and carbon totals.
- [ ] A resource is considered “missing carbon values” if any required carbon fields (e.g., A1–A3, A4, A5A, B2–B5, etc.) are null, zero (if not expected), or not calculated.
- [ ] Scope of Scan
- [ ] Detection Logic

### VER10-9164: Manage Master Spend Profiles -BE

**Status:** Ready for release | **Points:** 3
**FR Trace:** FR890

#### Description

Manage Master Spend Profiles: As an Admin user, I want to import, view, and update default spend profiles for each scheme type using a standard Excel template, so that I can efficiently set up the foundational data required for expenditure forecasting.

• Acceptance Criteria (New, based on uploaded images):
1. Access and Filtering: The System Admin can access the Master Spend Profiles screen under the Administration menu, which must allow filtering by Lifecycle Stage and Scheme Type.
1. Life Cycle Stage Association: The System Admin must select the applicable Life Cycle Stage for a Cost Element configuration before saving the configuration.
1. Lifecycle stages : the applicable lifecycle stages are New Construction, Asset Renewals, Operations and Maintenance and LTA.
1. the system must not commit changes for a new Master spend profile configuration if no lifecycle stage has been selected

2. the system must display a message : “Mandatory Field Missing: Life Cycle Stage. You must select an applicable Life Cycle Stage for this Spend Profile before you can save the configuration”

3. the system admin must be able to acknowledge and close this message

2. Scheme Type Association: The System Admin must select the applicable Schema Type for a Spend profile configuration before saving the configuration.
1. Scheme Type : the applicable Scheme Types  are as per the attached
1. the system must not commit changes for a new configuration if no Scheme Type has been selected

2. the system must display a message : “Mandatory Field Missing: Scheme Type. You must select an applicable Scheme Type for this Spend Profile before you can save the configuration”

3. the system admin must be able to acknowledge and close this message

2. Data View: The screen displays a grid of configured spend profiles, where rows are defined by the Spend Profile Type (from the Codes Library) and columns are defined by the 20 Time Divisions

3. Import Functionality: The system must offer two distinct import options:
• Import all data: Upload a CSV to replace all existing row data across all Lifecycles and Scheme Types.

• Import this scheme only: Upload a CSV to replace existing row data only for the currently selected Lifecycle Stage and Scheme Type.

4. Export Functionality: The system must offer three distinct export options:
• Export all data: Download a CSV with all row data across all Lifecycles and Scheme Types.

• Export this scheme only: Download a CSV with all row data for the currently selected Lifecycle Stage and Scheme Type.

• Export template: Download a CSV with only the column headers (Profile Type and 20 Time Divisions) to be used for data preparation.

5. Data Validation (Critical): Upon import, the system must validate that the sum of the 20 time division percentages for each profile row is exactly 100%.

6. Validation Failure Handling: If validation fails (sum is not 100%), the import must be blocked, and an error message must be displayed, including the option to "Generate Report" (CSV) of the invalid spreadsheet with the invalid rows highlighted.

7. Data Constraint: The percentage values in the time division columns (1 through 20) must be read-only on the screen; updates are only possible via the import mechanism.

8. Database structure: The backend DB will support up to 30 Time divisions

#### Test Checklist

- [ ] Acceptance Criteria (New, based on uploaded images):
- [ ] Import all data: Upload a CSV to replace all existing row data across all Lifecycles and Scheme Types.
- [ ] Import this scheme only: Upload a CSV to replace existing row data only for the currently selected Lifecycle Stage and Scheme Type.
- [ ] Export all data: Download a CSV with all row data across all Lifecycles and Scheme Types.
- [ ] Export this scheme only: Download a CSV with all row data for the currently selected Lifecycle Stage and Scheme Type.
- [ ] Export template: Download a CSV with only the column headers (Profile Type and 20 Time Divisions) to be used for data preparation.
- [ ] Access and Filtering: The System Admin can access the Master Spend Profiles screen under the Administration menu, which must allow filtering by Lifecycle Stage and Scheme Type.
- [ ] Life Cycle Stage Association: The System Admin must select the applicable Life Cycle Stage for a Cost Element configuration before saving the configuration.
- [ ] Lifecycle stages : the applicable lifecycle stages are New Construction, Asset Renewals, Operations and Maintenance and LTA.
- [ ] the system must not commit changes for a new Master spend profile configuration if no lifecycle stage has been selected
- [ ] the system must display a message : “Mandatory Field Missing: Life Cycle Stage. You must select an applicable Life Cycle Stage for this Spend Profile before you can save the configuration”
- [ ] the system admin must be able to acknowledge and close this message
- [ ] Scheme Type Association: The System Admin must select the applicable Schema Type for a Spend profile configuration before saving the configuration.
- [ ] Scheme Type : the applicable Scheme Types  are as per the attached
- [ ] the system must not commit changes for a new configuration if no Scheme Type has been selected
- [ ] the system must display a message : “Mandatory Field Missing: Scheme Type. You must select an applicable Scheme Type for this Spend Profile before you can save the configuration”
- [ ] the system admin must be able to acknowledge and close this message
- [ ] Data View: The screen displays a grid of configured spend profiles, where rows are defined by the Spend Profile Type (from the Codes Library) and columns are defined by the 20 Time Divisions
- [ ] Import Functionality: The system must offer two distinct import options:
- [ ] Export Functionality: The system must offer three distinct export options:
- [ ] Data Validation (Critical): Upon import, the system must validate that the sum of the 20 time division percentages for each profile row is exactly 100%.
- [ ] Validation Failure Handling: If validation fails (sum is not 100%), the import must be blocked, and an error message must be displayed, including the option to "Generate Report" (CSV) of the invalid spreadsheet with the invalid rows highlighted.
- [ ] Data Constraint: The percentage values in the time division columns (1 through 20) must be read-only on the screen; updates are only possible via the import mechanism.
- [ ] Database structure: The backend DB will support up to 30 Time divisions

### VER10-9165: Configure NRVAT % i.e. Non Recoverable VAT -BE

**Status:** Ready for release | **Points:** 1

#### Description

User story

As an System Admin, I need the  NRVAT Hybrid % captured at estimate level, and to be able to specify which Cost elements require an NR Vat % applied so that the system can use these values for automated calculations in the CCESS report.

This requirement is for a  field within the Estimate details where an estimator inputs the specific Non-Recoverable VAT Hybrid percentage that applies only to their estimate. This value is then used by the system as the rate for the NRVAT Hybrid calculation.

Acceptance Criteria

1. Access: NR Vat Hybrid can be defined at estimate level within the estimate details.

2. Configuration Field: The Estimator must be able to specify the NR VAT rate using a numeric input field labelled "NR VAT Hybrid Rate %."

3. Data Validation (VAT Rate): The input field for the NR VAT Hybrid % rate must enforce the following:
• Numeric Only: Only numeric values (including decimals) are accepted.

• Range: The value must be between 0.00 and 100.00.

• Required: The field must not be empty.

4. Data Constraint (Save): The system must enforce that a single, validated percentage value is entered and saved.

5. Data Application: The saved rate must be correctly applied to all  calculations requiring Non-Recoverable VAT (NRVAT) across the specified estimate.

#### Test Checklist

- [ ] Numeric Only: Only numeric values (including decimals) are accepted.
- [ ] Range: The value must be between 0.00 and 100.00.
- [ ] Required: The field must not be empty.
- [ ] Access: NR Vat Hybrid can be defined at estimate level within the estimate details.
- [ ] Configuration Field: The Estimator must be able to specify the NR VAT rate using a numeric input field labelled "NR VAT Hybrid Rate %."
- [ ] Data Validation (VAT Rate): The input field for the NR VAT Hybrid % rate must enforce the following:
- [ ] Required: The field must not be empty.
- [ ] Data Constraint (Save): The system must enforce that a single, validated percentage value is entered and saved.
- [ ] Data Application: The saved rate must be correctly applied to all  calculations requiring Non-Recoverable VAT (NRVAT) across the specified estimate.

### VER10-9177: Standard Codes - Copy To All Lifecycle - BE

**Status:** Ready for release | **Points:** 1

#### Description

Need to create a API to allow user to copyToAllLifecycle for a selected System Code Type.API /api/v2/system-code/copyToAllLifecycleparam codeType , lifecyclestageIdIf the Code Exist for the other lifecyclestageIds, Before copying we will clear it and Bulk Insert all the Codes similar to lifecyclestageId in a param.

### VER10-9207: Ignore validation  for "Mandatory on Create/update" flag for RFE triggered estimates

**Status:** Ready for release | **Points:** 1
**FR Trace:** FR780, FR782

#### Description

User Story 

As a system I want to ignore the mandatory on creation flag for custom fields for REF created estimates, so that I can progress my estimates without being blocked 

Acceptance Criteria

• Given my estimate creation has been initiated/ triggered via the RFE process, then all configured custom fields must  be created and  the solution must not block progressing of the estimate as a result of the flag “mandatory on creation/update ” specified for any custom field

• The solution must however validate that any custom fields flagged as “mandatory on creation/update ” are validated on update

#### Test Checklist

- [ ] Given my estimate creation has been initiated/ triggered via the RFE process, then all configured custom fields must  be created and  the solution must not block progressing of the estimate as a result of the flag “mandatory on creation/update ” specified for any custom field
- [ ] The solution must however validate that any custom fields flagged as “mandatory on creation/update ” are validated on update

### VER10-9239: Configure Statuses in System Codes - UI

**Status:** In QA | **Points:** 3

#### Description

As a System Admin, I need a single, centralized interface to Create, Read, Update, and Delete (CRUD) all core National Highways reference lists (Codes), including Estimate Scheme Types, Estimate Stages, Estimate Classifications/Levels, Spend Profile Types and Report Structure, so that the system ensures consistent project classification, maturity assessment, and expenditure forecasting based on predefined, hierarchical rules.

Acceptance Criteria:

1. Access and Navigation: The System Admin can access a dedicated screen titled "Standard Codes" which is accessible under Admin Codes Library

2. View Separation: The screen must display a list of all Code Types on the left panel (e.g Estimate stage type, Scheme Type), and the details of the selected Code Type on the right.

3. CRUD Functionality: The System Admin can Create, Read, Update, and Delete (CRUD) items within each list.

4. Deletion Prevention (In Use): The system prevents a hard delete of any Code if it is currently mapped to a configuration table (e.g. Spend Profile mapping) or actively referenced by a live estimate. A clear error message must be displayed. “Code name is in use and cannot be deleted”

5. Data Structure: Creating a new code item requires the Admin to input a unique Code/ Code Description.

6. Life Cycle Stage Filtering: The UI must include a mandatory "Lifecycle Stage" dropdown that allows the Admin to view and configure the code list specifically for the selected Life Cycle

7. Life Cycle Stage Configuration: When creating or editing any code variant, the code is automatically associated with the currently selected Life Cycle Stage from the dropdown before saving.

8. Code Duplication (Copy to All): The System Admin must have a "Copy to all lifecycles" function that copies the currently displayed and configured variants for the selected Life Cycle Stage to all other available Life Cycle Stages (including a confirmation prompt/warning regarding overwriting data).
1. The system must display a prompt before the “copy to all” action is committed : “You are about to copy all the configured codes for the currently selected Lifecycle Stage ([Insert Current Lifecycle Stage Here]) to all other available Lifecycle Stages. Do you want to procced”.

2. Options available are Cancel and Ok.

9. Unsaved Changes Control: The "Copy to all lifecycles" function must be disabled if there are unsaved changes to the variants in the current view

10. The following system codes must have a lifecycle filter:
1. Estimate Stage

2. Estimate Classification/ Estimate Level (✓)

3. Scheme Type

4. Spend Profile type (✓)

5. Economic Output (EO) Description

6. Organisation

7. Report Structure (✓)

 

 

 

 

The Data below is required for configuration for National highways

[Table content]

[Table content]

[Table content]

[Table content]

#### Test Checklist

- [ ] Access and Navigation: The System Admin can access a dedicated screen titled "Standard Codes" which is accessible under Admin Codes Library
- [ ] View Separation: The screen must display a list of all Code Types on the left panel (e.g Estimate stage type, Scheme Type), and the details of the selected Code Type on the right.
- [ ] CRUD Functionality: The System Admin can Create, Read, Update, and Delete (CRUD) items within each list.
- [ ] Deletion Prevention (In Use): The system prevents a hard delete of any Code if it is currently mapped to a configuration table (e.g. Spend Profile mapping) or actively referenced by a live estimate. A clear error message must be displayed. “Code name is in use and cannot be deleted”
- [ ] Data Structure: Creating a new code item requires the Admin to input a unique Code/ Code Description.
- [ ] Life Cycle Stage Filtering: The UI must include a mandatory "Lifecycle Stage" dropdown that allows the Admin to view and configure the code list specifically for the selected Life Cycle
- [ ] Life Cycle Stage Configuration: When creating or editing any code variant, the code is automatically associated with the currently selected Life Cycle Stage from the dropdown before saving.
- [ ] Code Duplication (Copy to All): The System Admin must have a "Copy to all lifecycles" function that copies the currently displayed and configured variants for the selected Life Cycle Stage to all other available Life Cycle Stages (including a confirmation prompt/warning regarding overwriting data).
- [ ] The system must display a prompt before the “copy to all” action is committed : “You are about to copy all the configured codes for the currently selected Lifecycle Stage ([Insert Current Lifecycle Stage Here]) to all other available Lifecycle Stages. Do you want to procced”.
- [ ] Options available are Cancel and Ok.
- [ ] Unsaved Changes Control: The "Copy to all lifecycles" function must be disabled if there are unsaved changes to the variants in the current view
- [ ] The following system codes must have a lifecycle filter:
- [ ] Estimate Stage
- [ ] Estimate Classification/ Estimate Level (✓)
- [ ] Scheme Type
- [ ] Spend Profile type (✓)
- [ ] Economic Output (EO) Description
- [ ] Organisation
- [ ] Report Structure (✓)

### VER10-9240: Configure Inflation Index Statuses in System Codes - BE

**Status:** Ready for release | **Points:** 3

### VER10-9289: Team4: Mandatory fields are not working as expected

**Status:** Ready for release | **Points:** 2

#### Description

Step to reproduce:

1. login to Benchmark web application

2. Navigate to Admin → Admin → Mandatory fields

3. Check few fields in project

Actual Result:

1. Quote No, Estimate Title should not be available as those two are default mandatory in Estimator tab


2.Getting 500 error while selecting the Project fields


1. Able to create Project without updating mandatory fields

2.

#### Test Checklist

- [ ] login to Benchmark web application
- [ ] Navigate to Admin → Admin → Mandatory fields
- [ ] Check few fields in project
- [ ] Quote No, Estimate Title should not be available as those two are default mandatory in Estimator tab
- [ ] Able to create Project without updating mandatory fields

### VER10-9314: Configure UIA Percentage Per Estimate Level - BE

**Status:** Ready for release | **Points:** 2

#### Description

User Story

As a System Admin, I need a modal configuration screen linked to each Cost Element to define the Unscheduled Items Allowance (UIA) percentage for every Estimate Level (Classification), so that the system can automatically apply the correct contingency based on both the cost type and the estimate's maturity level.

Acceptance Criteria (New, based on modal screenshot):

1. Access: The UIA configuration is accessed by clicking the UIA cell/column within a specific Cost Element row on the Cost Element Configuration screen. This action must trigger a modal dialog titled "Assign UIA Percentages."

2. Source Data (Estimate Levels): The modal must display a list of all configured Estimate Levels sourced from the NH Fixed Reporting Codes Library 

3. Configuration Fields: Next to each Estimate Level, there must be a dedicated input field labelled "UIA %" where the Admin can enter the specific allowance percentage.

4. Data Validation: The UIA % input fields must enforce numeric values only (including decimals) and must be mandatory (cannot be blank).

5. Default State: By default, all UIA % fields in the modal should be set to 0.00

6. Data Persistence: The Admin must click an "OK" button within the modal to save the configured percentages for that specific Cost Element. The modal must update the main table's UIA column display to reflect a set value e.g. "Assigned" where at least 1 UIA % value has been assigned or “Zero” indicating no UIA percentages have been assigned for that cost element. 

7. System Application: If a Cost Element is flagged as Apply UIA in the main configuration table, the system must use the percentage mapped in this modal corresponding to the Estimate Level of that cost element selected by the estimator for their project.

#### Test Checklist

- [ ] Access: The UIA configuration is accessed by clicking the UIA cell/column within a specific Cost Element row on the Cost Element Configuration screen. This action must trigger a modal dialog titled "Assign UIA Percentages."
- [ ] Source Data (Estimate Levels): The modal must display a list of all configured Estimate Levels sourced from the NH Fixed Reporting Codes Library
- [ ] Configuration Fields: Next to each Estimate Level, there must be a dedicated input field labelled "UIA %" where the Admin can enter the specific allowance percentage.
- [ ] Data Validation: The UIA % input fields must enforce numeric values only (including decimals) and must be mandatory (cannot be blank).
- [ ] Default State: By default, all UIA % fields in the modal should be set to 0.00
- [ ] Data Persistence: The Admin must click an "OK" button within the modal to save the configured percentages for that specific Cost Element. The modal must update the main table's UIA column display to reflect a set value e.g. "Assigned" where at least 1 UIA % value has been assigned or “Zero” indicating no UIA percentages have been assigned for that cost element.
- [ ] System Application: If a Cost Element is flagged as Apply UIA in the main configuration table, the system must use the percentage mapped in this modal corresponding to the Estimate Level of that cost element selected by the estimator for their project.

### VER10-9317:  Configure Lifecycle to Cost Element/ Report Structure Mapping BE

**Status:** Ready for release | **Points:** 2

#### Description

User Story 

As a System Admin, I need a central mapping table to define which Cost Element/Report  structure (e.g. PCF Cost Elements, O&M Cost Elements) is used for a given Lifecycle (e.g. New Construction) and Template Project Type (e.g., MP Capex), so that projects use the correct underlying financial breakdown for reporting.

Acceptance Criteria:

1. Access and Location: The System Admin can access this mapping table via a dedicated configuration screen in the main Administration Menu.

2. Mapping Table Structure: The screen must display a grid or table where the primary columns define the Lifecycle (e.g. New Construction, Renewals) 

3. Configurable Mapping: For each Lifecycle , the Admin must be able to select the appropriate Cost Element Configuration /Report Structure (e.g., PCF Cost Elements) via a dropdown menu.

4. Source Data: The dropdown menu options for the Cost Element/Report Structure must draw directly from the available structures configured in the System codes

5. Data Persistence: The mapping selection must be saved instantly or via a clear "Save" action.

6. Data Application: When a user creates a new estimate based on a specific Lifecycle and Template Project Type, the system must automatically load the mapped Cost Element Structure defined in this configuration screen.

7. The system must prevent a user from creating a cost element configuration that is not aligned to this mapping


[Table content]

#### Test Checklist

- [ ] Access and Location: The System Admin can access this mapping table via a dedicated configuration screen in the main Administration Menu.
- [ ] Mapping Table Structure: The screen must display a grid or table where the primary columns define the Lifecycle (e.g. New Construction, Renewals)
- [ ] Configurable Mapping: For each Lifecycle , the Admin must be able to select the appropriate Cost Element Configuration /Report Structure (e.g., PCF Cost Elements) via a dropdown menu.
- [ ] Source Data: The dropdown menu options for the Cost Element/Report Structure must draw directly from the available structures configured in the System codes
- [ ] Data Persistence: The mapping selection must be saved instantly or via a clear "Save" action.
- [ ] Data Application: When a user creates a new estimate based on a specific Lifecycle and Template Project Type, the system must automatically load the mapped Cost Element Structure defined in this configuration screen.
- [ ] The system must prevent a user from creating a cost element configuration that is not aligned to this mapping

### VER10-9393: Review SP changes

**Status:** Closed | **Points:** -

#### Description

• review SP by Amit Dabre - https://github.com/BenchmarkGlobalPtyLtd/BenchmarkV10/pull/6076#discussion_r2540461015 


• we also need to resolve the sonarqube issues that were raised in the stored procedures
• https://github.com/BenchmarkGlobalPtyLtd/BenchmarkV10/pull/6076/files#diff-604b16d79ea127ea76538b6d1ae6d16e3b3992db5be49de670d042a1f8e923df 

• https://github.com/BenchmarkGlobalPtyLtd/BenchmarkV10/pull/6076/files#diff-010a41100f64d00276009d8d4d6000a10143415d94f51066ea8eab4805d3e318

#### Test Checklist

- [ ] review SP by Amit Dabre - https://github.com/BenchmarkGlobalPtyLtd/BenchmarkV10/pull/6076#discussion_r2540461015
- [ ] we also need to resolve the sonarqube issues that were raised in the stored procedures
- [ ] https://github.com/BenchmarkGlobalPtyLtd/BenchmarkV10/pull/6076/files#diff-604b16d79ea127ea76538b6d1ae6d16e3b3992db5be49de670d042a1f8e923df
- [ ] https://github.com/BenchmarkGlobalPtyLtd/BenchmarkV10/pull/6076/files#diff-010a41100f64d00276009d8d4d6000a10143415d94f51066ea8eab4805d3e318

### VER10-9499: Team4: Relink Resources in Estimate - API

**Status:** Ready for release | **Points:** 3

#### Description

Scenario1:  For an unlinked Resource, if the Resource Code match an entry in the Resource Library, then when the Estimator relinks the resource, all fields—except Quantity, Text, Production Rate Group, Supplier, Cost Code, Factor, WBS, Crew size, Exclude Qty from Profit, Cartage—should be disabled and reset to the corresponding values from the Resource Library.



Scenario2: For an unlinked Resource, if the Resource Code does not matches an entry in the Resource Library, then when the Estimator attempts to relink the resource, the system should display the below pop-up message “No Resource in the Resource Library with this Code“ and prevent the Estimator from linking the resource. The resource should remain unlinked

### VER10-9513: Header sorting is not working

**Status:** Ready for release | **Points:** 1

#### Description

Client side header sorting is now working in the tables.

Missing sorting handler code in tanstack table header. 

When click on a non-disabled header of table display, there is no sort happening.

a/c :

The header sorting should working

There should be an arrow icon indicate the table header is in sorting.

---

## Appendix: FR Reference Summary

| FR | Issue Count | Key Issues |
|----|------------:|------------|
| FR90 | 14 | VER10-8570, VER10-8896, VER10-9255... |
| FR110 | 2 | VER10-8059, VER10-9491 |
| FR150 | 14 | VER10-8570, VER10-8896, VER10-9255... |
| FR180 | 1 | VER10-8765 |
| FR511 | 12 | VER10-8462, VER10-8463, VER10-8475... |
| FR601 | 1 | VER10-8570 |
| FR780 | 36 | VER10-8333, VER10-8334, VER10-8335... |
| FR782 | 54 | VER10-7528, VER10-7529, VER10-7530... |
| FR820 | 20 | VER10-8429, VER10-8487, VER10-8488... |
| FR830 | 21 | VER10-8429, VER10-8487, VER10-8488... |
| FR870 | 14 | VER10-8570, VER10-8896, VER10-9255... |
| FR880 | 14 | VER10-8570, VER10-8896, VER10-9255... |
| FR890 | 17 | VER10-8570, VER10-8720, VER10-8727... |
| FR930 | 14 | VER10-8570, VER10-8896, VER10-9255... |
| FR1170 | 18 | VER10-7528, VER10-7529, VER10-7530... |
| FR1340 | 3 | VER10-8508, VER10-8523, VER10-8758 |
| FR1490 | 14 | VER10-8570, VER10-8896, VER10-9255... |
| FR2230 | 3 | VER10-8508, VER10-8523, VER10-8758 |
