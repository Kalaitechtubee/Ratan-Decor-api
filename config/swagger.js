// config/swagger.js
const swaggerJsdoc = require('swagger-jsdoc');

const swaggerOptions = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Ratan Decor API',
      version: '1.0.0',
      description: 'A comprehensive e-commerce API for Ratan Decor home decor products',
      contact: {
        name: 'Ratan Decor API Support',
        email: 'support@ratandecor.com',
      },
      license: {
        name: 'MIT',
        url: 'https://spdx.org/licenses/MIT.html',
      },
    },
    servers: [
      {
        url: process.env.NODE_ENV === 'production' 
          ? 'https://api.ratandecor.com' 
          : `http://localhost:${process.env.PORT || 3000}`,
        description: process.env.NODE_ENV === 'production' 
          ? 'Production server' 
          : 'Development server',
      },
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
          description: 'Enter JWT token obtained from login endpoint',
        },
        apiKeyAuth: {
          type: 'apiKey',
          in: 'header',
          name: 'Authorization',
          description: 'API key for authentication',
        },
      },
      schemas: {
        // Common schemas
        Error: {
          type: 'object',
          properties: {
            success: {
              type: 'boolean',
              example: false,
            },
            message: {
              type: 'string',
              example: 'Error message',
            },
            error: {
              type: 'string',
              example: 'Detailed error information',
            },
          },
        },
        Success: {
          type: 'object',
          properties: {
            success: {
              type: 'boolean',
              example: true,
            },
            message: {
              type: 'string',
              example: 'Operation completed successfully',
            },
          },
        },
        PaginationInfo: {
          type: 'object',
          properties: {
            currentPage: {
              type: 'integer',
              example: 1,
            },
            totalPages: {
              type: 'integer',
              example: 10,
            },
            totalItems: {
              type: 'integer',
              example: 100,
            },
            itemsPerPage: {
              type: 'integer',
              example: 10,
            },
            hasNextPage: {
              type: 'boolean',
              example: true,
            },
            hasPrevPage: {
              type: 'boolean',
              example: false,
            },
          },
        },
        // User related schemas
        User: {
          type: 'object',
          properties: {
            id: {
              type: 'integer',
              example: 1,
            },
            firstName: {
              type: 'string',
              example: 'John',
            },
            lastName: {
              type: 'string',
              example: 'Doe',
            },
            email: {
              type: 'string',
              format: 'email',
              example: 'john.doe@example.com',
            },
            phone: {
              type: 'string',
              example: '+91 9876543210',
            },
            userTypeId: {
              type: 'integer',
              example: 2,
            },
            isActive: {
              type: 'boolean',
              example: true,
            },
            createdAt: {
              type: 'string',
              format: 'date-time',
            },
            updatedAt: {
              type: 'string',
              format: 'date-time',
            },
          },
        },
        UserType: {
          type: 'object',
          properties: {
            id: {
              type: 'integer',
              example: 1,
            },
            name: {
              type: 'string',
              example: 'Customer',
            },
            description: {
              type: 'string',
              example: 'Regular customer user type',
            },
            isActive: {
              type: 'boolean',
              example: true,
            },
          },
        },
        // Product related schemas
        Product: {
          type: 'object',
          properties: {
            id: {
              type: 'integer',
              example: 1,
            },
            name: {
              type: 'string',
              example: 'Elegant Sofa Set',
            },
            description: {
              type: 'string',
              example: 'Beautiful and comfortable sofa set for your living room',
            },
            price: {
              type: 'number',
              format: 'decimal',
              example: 25999.99,
            },
            originalPrice: {
              type: 'number',
              format: 'decimal',
              example: 29999.99,
            },
            discount: {
              type: 'number',
              format: 'decimal',
              example: 13.33,
            },
            categoryId: {
              type: 'integer',
              example: 1,
            },
            images: {
              type: 'array',
              items: {
                type: 'string',
              },
              example: ['/uploads/products/sofa1.jpg', '/uploads/products/sofa2.jpg'],
            },
            warranty: {
              type: 'string',
              example: '2 years manufacturer warranty',
            },
            inStock: {
              type: 'boolean',
              example: true,
            },
            stockQuantity: {
              type: 'integer',
              example: 50,
            },
            isActive: {
              type: 'boolean',
              example: true,
            },
            createdAt: {
              type: 'string',
              format: 'date-time',
            },
            updatedAt: {
              type: 'string',
              format: 'date-time',
            },
          },
        },
        // Category schema
        Category: {
          type: 'object',
          properties: {
            id: {
              type: 'integer',
              example: 1,
            },
            name: {
              type: 'string',
              example: 'Furniture',
            },
            description: {
              type: 'string',
              example: 'High-quality furniture for your home',
            },
            brandName: {
              type: 'string',
              example: 'Ratan Decor Premium',
            },
            image: {
              type: 'string',
              example: '/uploads/categories/furniture.jpg',
            },
            isActive: {
              type: 'boolean',
              example: true,
            },
            createdAt: {
              type: 'string',
              format: 'date-time',
            },
            updatedAt: {
              type: 'string',
              format: 'date-time',
            },
          },
        },
        // Cart related schemas
        CartItem: {
          type: 'object',
          properties: {
            id: {
              type: 'integer',
              example: 1,
            },
            userId: {
              type: 'integer',
              example: 1,
            },
            productId: {
              type: 'integer',
              example: 1,
            },
            quantity: {
              type: 'integer',
              example: 2,
            },
            price: {
              type: 'number',
              format: 'decimal',
              example: 25999.99,
            },
            createdAt: {
              type: 'string',
              format: 'date-time',
            },
            updatedAt: {
              type: 'string',
              format: 'date-time',
            },
          },
        },
        // Order related schemas
        Order: {
          type: 'object',
          properties: {
            id: {
              type: 'integer',
              example: 1,
            },
            orderNumber: {
              type: 'string',
              example: 'ORD-2025-001',
            },
            userId: {
              type: 'integer',
              example: 1,
            },
            totalAmount: {
              type: 'number',
              format: 'decimal',
              example: 51999.98,
            },
            status: {
              type: 'string',
              enum: ['pending', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled'],
              example: 'pending',
            },
            shippingAddress: {
              type: 'object',
              properties: {
                street: { type: 'string' },
                city: { type: 'string' },
                state: { type: 'string' },
                pincode: { type: 'string' },
                country: { type: 'string' },
              },
            },
            paymentStatus: {
              type: 'string',
              enum: ['pending', 'paid', 'failed', 'refunded'],
              example: 'pending',
            },
            createdAt: {
              type: 'string',
              format: 'date-time',
            },
            updatedAt: {
              type: 'string',
              format: 'date-time',
            },
          },
        },
        // SEO schema
        SEO: {
          type: 'object',
          properties: {
            id: {
              type: 'integer',
              example: 1,
            },
            pageName: {
              type: 'string',
              example: 'home',
            },
            title: {
              type: 'string',
              example: 'Home - Ratan Decor',
            },
            description: {
              type: 'string',
              example: 'Welcome to Ratan Decor, your one-stop shop for premium home decor.',
            },
            keywords: {
              type: 'string',
              example: 'home, ratan decor, home decor',
            },
            createdAt: {
              type: 'string',
              format: 'date-time',
            },
            updatedAt: {
              type: 'string',
              format: 'date-time',
            },
          },
        },
        // Address schema
        Address: {
          type: 'object',
          properties: {
            id: {
              type: 'integer',
              example: 1,
            },
            userId: {
              type: 'integer',
              example: 1,
            },
            type: {
              type: 'string',
              enum: ['home', 'work', 'other'],
              example: 'home',
            },
            street: {
              type: 'string',
              example: '123 Main Street',
            },
            city: {
              type: 'string',
              example: 'Mumbai',
            },
            state: {
              type: 'string',
              example: 'Maharashtra',
            },
            pincode: {
              type: 'string',
              example: '400001',
            },
            country: {
              type: 'string',
              example: 'India',
            },
            isDefault: {
              type: 'boolean',
              example: true,
            },
            createdAt: {
              type: 'string',
              format: 'date-time',
            },
            updatedAt: {
              type: 'string',
              format: 'date-time',
            },
          },
        },
        // Enquiry schema
        Enquiry: {
          type: 'object',
          properties: {
            id: {
              type: 'integer',
              example: 1,
            },
            name: {
              type: 'string',
              example: 'John Doe',
            },
            email: {
              type: 'string',
              format: 'email',
              example: 'john.doe@example.com',
            },
            phone: {
              type: 'string',
              example: '+91 9876543210',
            },
            subject: {
              type: 'string',
              example: 'Product Inquiry',
            },
            message: {
              type: 'string',
              example: 'I am interested in your sofa collection.',
            },
            status: {
              type: 'string',
              enum: ['new', 'in-progress', 'resolved', 'closed'],
              example: 'new',
            },
            createdAt: {
              type: 'string',
              format: 'date-time',
            },
            updatedAt: {
              type: 'string',
              format: 'date-time',
            },
          },
        },
      },
      responses: {
        NotFound: {
          description: 'Resource not found',
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/Error',
              },
            },
          },
        },
        ValidationError: {
          description: 'Validation error',
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/Error',
              },
            },
          },
        },
        UnauthorizedError: {
          description: 'Authentication required',
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/Error',
              },
            },
          },
        },
        ForbiddenError: {
          description: 'Insufficient permissions',
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/Error',
              },
            },
          },
        },
        ServerError: {
          description: 'Internal server error',
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/Error',
              },
            },
          },
        },
      },
      parameters: {
        PageParam: {
          in: 'query',
          name: 'page',
          schema: {
            type: 'integer',
            minimum: 1,
            default: 1,
          },
          description: 'Page number for pagination',
        },
        LimitParam: {
          in: 'query',
          name: 'limit',
          schema: {
            type: 'integer',
            minimum: 1,
            maximum: 100,
            default: 10,
          },
          description: 'Number of items per page',
        },
        SortParam: {
          in: 'query',
          name: 'sort',
          schema: {
            type: 'string',
            enum: ['createdAt', '-createdAt', 'name', '-name', 'price', '-price'],
            default: '-createdAt',
          },
          description: 'Sort field and direction (prefix with - for descending)',
        },
      },
    },
    tags: [
      {
        name: 'Authentication',
        description: 'User authentication and authorization endpoints',
      },
      {
        name: 'Products',
        description: 'Product management endpoints',
      },
      {
        name: 'Categories',
        description: 'Category management endpoints',
      },
      {
        name: 'Cart',
        description: 'Shopping cart management endpoints',
      },
      {
        name: 'Orders',
        description: 'Order management endpoints',
      },
      {
        name: 'Users',
        description: 'User management endpoints',
      },
      {
        name: 'Addresses',
        description: 'Address management endpoints',
      },
      {
        name: 'Admin',
        description: 'Admin panel endpoints',
      },
      {
        name: 'Profile',
        description: 'User profile management endpoints',
      },
      {
        name: 'SEO',
        description: 'SEO management endpoints',
      },
      {
        name: 'Enquiries',
        description: 'Customer enquiry endpoints',
      },
      {
        name: 'Video Call Enquiries',
        description: 'Video call enquiry endpoints',
      },
      {
        name: 'User Types',
        description: 'User type management endpoints',
      },
      {
        name: 'User Roles',
        description: 'User role management endpoints',
      },
      {
        name: 'System',
        description: 'System health and status endpoints',
      },
    ],
  },
  apis: [
    './auth/routes.js',
    './product/routes.js',
    './admin/routes.js',
    './address/routes.js',
    './cart/routes.js',
    './order/routes.js',
    './profile/routes.js',
    './category/routes.js',
    './userType/routes.js',
    './user/routes.js',
    './shipping-address/routes.js',
    './userRole/routes.js',
    './enquiry/routes.js',
    './seo/routes.js',
    './VideoCallEnquiry/routes.js',
    './server.js', // For health check endpoints
  ],
};

const swaggerSpec = swaggerJsdoc(swaggerOptions);

module.exports = swaggerSpec;