import { detectEndpoints } from '../skill/endpoint-detector';
import type { RepoContext } from '../types';

function makeContext(fileContents: Record<string, string>): RepoContext {
  return {
    owner: 'test',
    repo: 'test',
    defaultBranch: 'main',
    filePaths: Object.keys(fileContents),
    fileContents: new Map(Object.entries(fileContents)),
  };
}

describe('detectEndpoints', () => {
  describe('Express / Node.js', () => {
    it('detects GET and POST routes', () => {
      const ctx = makeContext({
        'src/routes/users.ts': `
          import express from 'express';
          const router = express.Router();
          router.get('/api/users', listUsers);
          router.post('/api/users', createUser);
          router.get('/api/users/:id', getUser);
          router.put('/api/users/:id', updateUser);
          router.delete('/api/users/:id', deleteUser);
        `,
      });
      const apps = detectEndpoints(ctx);
      const endpoints = apps[0].endpoints;

      const methods = endpoints.map((e) => e.method);
      expect(methods).toContain('GET');
      expect(methods).toContain('POST');
      expect(methods).toContain('PUT');
      expect(methods).toContain('DELETE');
    });

    it('extracts path parameters', () => {
      const ctx = makeContext({
        'src/routes/items.ts': `
          router.get('/api/items/:id', getItem);
        `,
      });
      const apps = detectEndpoints(ctx);
      const ep = apps[0].endpoints.find((e) => e.path === '/api/items/:id');
      expect(ep).toBeDefined();
      expect(ep?.params).toContain('id');
    });

    it('marks POST/PUT/PATCH endpoints as hasBody=true', () => {
      const ctx = makeContext({
        'src/routes/orders.ts': `
          router.post('/api/orders', createOrder);
          router.put('/api/orders/:id', updateOrder);
          router.patch('/api/orders/:id/status', patchOrder);
          router.get('/api/orders', listOrders);
        `,
      });
      const apps = detectEndpoints(ctx);
      const endpoints = apps[0].endpoints;

      for (const ep of endpoints.filter((e) =>
        ['POST', 'PUT', 'PATCH'].includes(e.method),
      )) {
        expect(ep.hasBody).toBe(true);
      }
      for (const ep of endpoints.filter((e) => e.method === 'GET')) {
        expect(ep.hasBody).toBe(false);
      }
    });

    it('deduplicates identical routes from multiple patterns', () => {
      const ctx = makeContext({
        'src/routes/health.ts': `
          app.get('/health', check);
          app.get('/health', check);
        `,
      });
      const apps = detectEndpoints(ctx);
      const healthEps = apps[0].endpoints.filter((e) => e.path === '/health');
      expect(healthEps.length).toBe(1);
    });
  });

  describe('NestJS decorators', () => {
    it('detects @Get and @Post decorators', () => {
      const ctx = makeContext({
        'src/users/users.controller.ts': `
          @Controller('users')
          export class UsersController {
            @Get()
            findAll() {}

            @Get(':id')
            findOne(@Param('id') id: string) {}

            @Post()
            create(@Body() dto: CreateUserDto) {}

            @Put(':id')
            update(@Param('id') id: string) {}

            @Delete(':id')
            remove(@Param('id') id: string) {}
          }
        `,
      });
      const apps = detectEndpoints(ctx);
      const endpoints = apps[0].endpoints;
      const methods = endpoints.map((e) => e.method);
      expect(methods).toContain('GET');
      expect(methods).toContain('POST');
      expect(methods).toContain('PUT');
      expect(methods).toContain('DELETE');
    });
  });

  describe('FastAPI / Python', () => {
    it('detects FastAPI route decorators', () => {
      const ctx = makeContext({
        'app/routers/users.py': `
from fastapi import APIRouter

router = APIRouter()

@router.get("/users")
async def list_users():
    pass

@router.post("/users")
async def create_user():
    pass

@router.get("/users/{user_id}")
async def get_user(user_id: int):
    pass

@router.delete("/users/{user_id}")
async def delete_user(user_id: int):
    pass
        `,
      });
      const apps = detectEndpoints(ctx);
      const endpoints = apps[0].endpoints;
      const methods = endpoints.map((e) => e.method);
      expect(methods).toContain('GET');
      expect(methods).toContain('POST');
      expect(methods).toContain('DELETE');
    });
  });

  describe('Flask / Python', () => {
    it('detects @app.route decorators', () => {
      const ctx = makeContext({
        'app/views.py': `
from flask import Flask

app = Flask(__name__)

@app.route('/api/products', methods=['GET'])
def list_products():
    pass

@app.route('/api/products', methods=['POST'])
def create_product():
    pass
        `,
      });
      const apps = detectEndpoints(ctx);
      const endpoints = apps[0].endpoints;
      const methods = endpoints.map((e) => e.method);
      expect(methods).toContain('GET');
      expect(methods).toContain('POST');
    });
  });

  describe('Spring Boot / Java', () => {
    it('detects @GetMapping and @PostMapping', () => {
      const ctx = makeContext({
        'src/main/java/com/example/UserController.java': `
@RestController
@RequestMapping("/api")
public class UserController {
    @GetMapping("/users")
    public List<User> listUsers() {}

    @PostMapping("/users")
    public User createUser(@RequestBody UserDto dto) {}

    @GetMapping("/users/{id}")
    public User getUser(@PathVariable Long id) {}

    @DeleteMapping("/users/{id}")
    public void deleteUser(@PathVariable Long id) {}
}
        `,
      });
      const apps = detectEndpoints(ctx);
      const endpoints = apps[0].endpoints;
      const methods = endpoints.map((e) => e.method);
      expect(methods).toContain('GET');
      expect(methods).toContain('POST');
      expect(methods).toContain('DELETE');
    });
  });

  describe('Gin / Go', () => {
    it('detects Gin route registrations', () => {
      const ctx = makeContext({
        'cmd/server/main.go': `
package main

import "github.com/gin-gonic/gin"

func main() {
    r := gin.Default()
    r.GET("/api/items", listItems)
    r.POST("/api/items", createItem)
    r.GET("/api/items/:id", getItem)
    r.PUT("/api/items/:id", updateItem)
    r.DELETE("/api/items/:id", deleteItem)
    r.Run(":8080")
}
        `,
      });
      const apps = detectEndpoints(ctx);
      const endpoints = apps[0].endpoints;
      expect(endpoints.length).toBeGreaterThanOrEqual(5);
    });
  });

  describe('buildName', () => {
    it('generates snake_case names', () => {
      const ctx = makeContext({
        'routes.ts': `
          router.get('/api/users', listUsers);
          router.post('/api/users', createUser);
          router.get('/api/users/:id', getUser);
        `,
      });
      const apps = detectEndpoints(ctx);
      const names = apps[0].endpoints.map((e) => e.name);
      expect(names).toContain('get_api_users');
      expect(names).toContain('post_api_users');
      expect(names).toContain('get_api_users_id');
    });
  });

  describe('monorepo scoped detection', () => {
    it('only scans files under the given app path', () => {
      const ctx = makeContext({
        'apps/api/src/routes.ts': `router.get('/api/health', healthCheck);`,
        'apps/web/pages/index.ts': `// frontend only`,
      });
      const apps = detectEndpoints(ctx, ['apps/api']);
      expect(apps[0].endpoints.some((e) => e.path === '/api/health')).toBe(true);
    });
  });
});
