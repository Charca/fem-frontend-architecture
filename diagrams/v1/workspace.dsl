workspace "CommerceOS - v1" "C4 model for CommerceOS, a Shopify-like platform for creating storefronts and selling products online." {
    !identifiers hierarchical

    model {
        user = person "User" "Signs up for CommerceOS to create a store and sell products online."
        customer = person "Customer" "Purchases products from a User's storefront."

        group "CommerceOS" {
            storefront = softwareSystem "Storefront" "Customer-facing ecommerce frontend."

            admin = softwareSystem "Admin System" "Platform that Users use to manage storefronts." {
                web = container "Admin Web App" "Browser-based interface for managing stores, products, orders, and settings." "React SPA"
                api = container "Core API" "Gateway API used by both the Admin and Storefront systems." "Go/Gin REST API"
                db = container "Core DB" "Stores users, stores, products, orders, customer records, and platform configuration." "Postgres" {
                    tags "Database"
                }
            }
        }

        payments = softwareSystem "Payments System" "Third-party system that manages payment processing, payouts, and refunds." "Stripe"
        fulfillment = softwareSystem "Order Fulfillment System" "Third-party system that manages shipping, shelving, inventory handling, and fulfillment."

        user -> admin "Manages storefronts, products, orders, shipping settings, and payments"
        customer -> storefront "Browses products and checks out"
        admin -> storefront "Publishes storefront configuration and catalog changes"
        storefront -> admin.api "Reads catalog data and creates carts/orders" "HTTPS/JSON"
        admin -> payments "Configures payment accounts and receives payment status"
        admin -> fulfillment "Sends fulfillment requests and receives shipment status"
        payments -> admin.api "Sends payment events" "Webhooks"
        fulfillment -> admin.api "Sends fulfillment and shipment events" "Webhooks"

        user -> admin.web "Uses"
        admin.web -> admin.api "Manages commerce resources" "HTTPS/JSON"
        admin.api -> admin.db "Reads from and writes to" "SQL"
        admin.api -> payments "Creates payment sessions and refunds" "HTTPS/JSON"
        admin.api -> fulfillment "Creates fulfillment requests" "HTTPS/JSON"
    }

    views {
        systemContext admin "SystemContext" {
            include user
            include customer
            include storefront
            include admin
            include payments
            include fulfillment
            exclude "storefront -> admin"
            exclude "payments -> admin"
            exclude "fulfillment -> admin"
            autolayout tb
        }

        container admin "AdminContainers" {
            include user
            include customer
            include storefront
            include admin.web
            include admin.api
            include admin.db
            include payments
            include fulfillment
            exclude "payments -> admin.api"
            exclude "fulfillment -> admin.api"
            autolayout lr 450 450
        }

        styles {
            element "Person" {
                shape person
                background #0f766e
                color #ffffff
            }

            element "Software System" {
                background #1f2937
                color #ffffff
            }

            element "Container" {
                background #2563eb
                color #ffffff
            }

            element "Database" {
                shape cylinder
                background #7c3aed
                color #ffffff
            }

            element "Group" {
                color #94a3b8
                stroke #334155
                strokeWidth 2
                border solid
            }

            element "Boundary:SoftwareSystem" {
                color #94a3b8
                stroke #334155
                strokeWidth 2
                border solid
            }
        }
    }

    configuration {
        properties {
            "structurizr.introduction" "false"
        }
    }
}
